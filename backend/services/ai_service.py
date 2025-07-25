"""
Servicio de IA Multi-proveedor - Extracción Inteligente de Metadatos

Este módulo proporciona una interfaz unificada para múltiples proveedores
de IA (Google Gemini, OpenAI, DeepSeek) para el análisis y extracción
automática de metadatos de documentos.
"""

from __future__ import annotations

import io
import json
import re
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Dict, Callable, Any, Optional
from abc import ABC, abstractmethod

import pdfplumber
from docx import Document as DocxDocument
from pptx import Presentation
import openpyxl

from openai import OpenAI
from google.generativeai import GenerativeModel, configure

from config import settings

# Extensiones permitidas
ALLOWED_EXTENSIONS = {'.pdf', '.docx', '.pptx', '.xlsx', '.txt', '.md'}

# Diccionarios de handlers
_EXTRACTION_HANDLERS: Dict[str, Callable[[bytes], str]] = {}
_AI_PROVIDERS: Dict[str, type["AIService"]] = {}


# ==================================================================================
#                    FUNCIONES DE EXTRACCIÓN DE TEXTO
# ==================================================================================

def _text_from_pdf(file_bytes: bytes) -> str:
    """Extrae texto de un archivo PDF."""
    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            pages_text = []
            for page in pdf.pages:
                text = page.extract_text(x_tolerance=1, y_tolerance=1)
                if text:
                    pages_text.append(text.strip())
            return "\n\n".join(pages_text)
    except Exception:
        return ""

def _text_from_docx(file_bytes: bytes) -> str:
    """Extrae texto de un documento Word."""
    try:
        doc = DocxDocument(io.BytesIO(file_bytes))
        paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
        return "\n\n".join(paragraphs)
    except Exception:
        return ""

def _text_from_pptx(file_bytes: bytes) -> str:
    """Extrae texto de una presentación PowerPoint."""
    try:
        presentation = Presentation(io.BytesIO(file_bytes))
        slides_content = []
        
        for slide_num, slide in enumerate(presentation.slides, 1):
            slide_texts = []
            for shape in slide.shapes:
                if hasattr(shape, "text") and shape.text.strip():
                    slide_texts.append(shape.text.strip())
            
            if slide_texts:
                slide_content = f"--- Diapositiva {slide_num} ---\n" + "\n".join(slide_texts)
                slides_content.append(slide_content)
                
        return "\n\n".join(slides_content)
    except Exception:
        return ""

def _text_from_xlsx(file_bytes: bytes) -> str:
    """Extrae texto de una hoja de cálculo Excel."""
    try:
        workbook = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
        sheets_content = []
        
        for sheet in workbook.worksheets:
            sheet_title = f"--- Hoja: {sheet.title} ---"
            rows_content = []
            
            for row in sheet.iter_rows(values_only=True):
                row_values = [str(cell).strip() for cell in row if cell is not None and str(cell).strip()]
                if row_values:
                    rows_content.append(" | ".join(row_values))
            
            if rows_content:
                sheet_content = sheet_title + "\n" + "\n".join(rows_content)
                sheets_content.append(sheet_content)
                
        return "\n\n".join(sheets_content)
    except Exception:
        return ""

# Registrar handlers
_EXTRACTION_HANDLERS.update({
    ".pdf": _text_from_pdf,
    ".docx": _text_from_docx,
    ".pptx": _text_from_pptx,
    ".xlsx": _text_from_xlsx,
})


# ==================================================================================
#                    CLASES DE SERVICIOS DE IA
# ==================================================================================

def _extract_text_content(file_bytes: bytes, file_extension: str) -> str:
    """Extrae texto del archivo según su tipo."""
    ext = file_extension.lower().strip()
    handler = _EXTRACTION_HANDLERS.get(ext)
    
    if handler:
        try:
            extracted_text = handler(file_bytes)
            if extracted_text.strip():
                return extracted_text
        except Exception:
            pass
    
    # Fallback: intentar decodificar como texto
    try:
        for encoding in ['utf-8', 'latin-1', 'cp1252']:
            try:
                decoded_text = file_bytes.decode(encoding, errors='ignore')
                if decoded_text.strip():
                    return decoded_text
            except:
                continue
        return file_bytes.decode('utf-8', errors='ignore')
    except Exception:
        return "Contenido no extraíble - archivo binario"


class AIService(ABC):
    """Clase base abstracta para servicios de IA."""
    
    def __init__(self):
        self.max_text_length = settings.MAX_TEXT_LENGTH
        self.max_summary_words = settings.MAX_SUMMARY_WORDS
        self.max_keywords = settings.MAX_KEYWORDS
        self.api_timeout = settings.API_TIMEOUT
        self.model_name = "unknown"
    
    def _create_analysis_prompt(self, text_content: str) -> str:
        """Crea el prompt para análisis de documentos."""
        return f"""
Eres un asistente experto en análisis y extracción de metadatos de documentos profesionales.

TAREA: Analiza el documento y extrae los metadatos en formato JSON estricto.

INSTRUCCIONES:
1. "title": Extrae el título principal o tema central.
2. "summary": Resumen conciso de máximo {self.max_summary_words} palabras.
3. "keywords": Entre 5 y {self.max_keywords} palabras clave relevantes.
4. "date": Fecha más significativa en formato YYYY-MM-DD o "Fecha no encontrada".

FORMATO DE SALIDA:
- Responde ÚNICAMENTE con el objeto JSON
- NO incluyas bloques de código markdown
- NO añadas texto explicativo

DOCUMENTO:
{text_content[:self.max_text_length]}
"""
    
    def _parse_response(self, raw_response: str) -> Dict[str, Any]:
        """Parsea la respuesta del servicio de IA."""
        try:
            # Intentar parsear directo
            data = json.loads(raw_response.strip())
            if isinstance(data, dict):
                return data
        except json.JSONDecodeError:
            pass
        
        # Buscar JSON en la respuesta
        json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', raw_response, re.DOTALL)
        if json_match:
            try:
                data = json.loads(json_match.group(1).strip())
                if isinstance(data, dict):
                    return data
            except json.JSONDecodeError:
                pass
        
        # Buscar JSON entre llaves
        start_brace = raw_response.find('{')
        end_brace = raw_response.rfind('}')
        
        if start_brace != -1 and end_brace != -1 and start_brace < end_brace:
            try:
                data = json.loads(raw_response[start_brace:end_brace + 1])
                if isinstance(data, dict):
                    return data
            except json.JSONDecodeError:
                pass
        
        # Fallback
        return {
            "title": "Error de parseo",
            "summary": "No se pudo extraer el resumen.",
            "keywords": [],
            "date": "Fecha no encontrada"
        }
    
    @abstractmethod
    def _call_ai(self, text_content: str) -> Dict[str, Any]:
        """Realiza la llamada al servicio de IA."""
        pass
    
    def extract_metadata(self, file_bytes: bytes, filename: str) -> Dict[str, Any]:
        """Extrae metadatos del archivo."""
        try:
            path = Path(filename)
            file_extension = path.suffix.lower()
            file_id = path.stem
            
            # Extraer texto
            text_content = _extract_text_content(file_bytes, file_extension)
            if not text_content.strip():
                text_content = f"Archivo de tipo {file_extension} sin contenido extraíble."
            
            # Llamar a IA
            ai_metadata = self._call_ai(text_content)
            
            # Calcular hash
            file_hash = hashlib.sha256(file_bytes).hexdigest()
            
            return {
                "id": file_id,
                "filename": filename,
                "file_extension": file_extension,
                "file_size_bytes": len(file_bytes),
                "title": ai_metadata["title"],
                "summary": ai_metadata["summary"],
                "keywords": ai_metadata["keywords"],
                "date": ai_metadata["date"],
                "processing_timestamp": datetime.now().isoformat() + "Z",
                "ai_model": self.model_name,
                "text_length": len(text_content),
                "file_hash": file_hash
            }
        except Exception as e:
            return {
                "id": Path(filename).stem,
                "filename": filename,
                "file_extension": Path(filename).suffix.lower(),
                "file_size_bytes": len(file_bytes),
                "title": f"Error procesando {filename}",
                "summary": "No se pudieron extraer metadatos.",
                "keywords": [],
                "date": "Fecha no encontrada",
                "processing_timestamp": datetime.now().isoformat() + "Z",
                "error": str(e),
                "file_hash": hashlib.sha256(file_bytes).hexdigest()
            }


class GeminiService(AIService):
    """Servicio de Google Gemini."""
    
    def __init__(self):
        super().__init__()
        self.model_name = "gemini-1.5-flash-latest"
        configure(api_key=settings.GEMINI_API_KEY)
        self.client = GenerativeModel(self.model_name)
    
    def _call_ai(self, text_content: str) -> Dict[str, Any]:
        try:
            prompt = self._create_analysis_prompt(text_content)
            response = self.client.generate_content(
                prompt,
                request_options={"timeout": self.api_timeout}
            )
            raw_text = response.text
            parsed_data = self._parse_response(raw_text)
            
            return {
                "title": str(parsed_data.get("title", "Título no encontrado")).strip(),
                "summary": str(parsed_data.get("summary", "Resumen no disponible")).strip(),
                "keywords": parsed_data.get("keywords", []) if isinstance(parsed_data.get("keywords"), list) else [],
                "date": str(parsed_data.get("date", "Fecha no encontrada")).strip(),
            }
        except Exception as e:
            return {
                "title": "Error de procesamiento con Gemini",
                "summary": f"Error: {str(e)}",
                "keywords": [],
                "date": "Fecha no encontrada",
            }


class OpenAIService(AIService):
    """Servicio de OpenAI."""
    
    def __init__(self):
        super().__init__()
        self.model_name = "gpt-4o-mini"
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
    
    def _call_ai(self, text_content: str) -> Dict[str, Any]:
        try:
            prompt = self._create_analysis_prompt(text_content)
            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": "Eres un asistente experto en análisis de documentos."},
                    {"role": "user", "content": prompt}
                ],
                timeout=self.api_timeout
            )
            raw_text = response.choices[0].message.content
            parsed_data = self._parse_response(raw_text)
            
            return {
                "title": str(parsed_data.get("title", "Título no encontrado")).strip(),
                "summary": str(parsed_data.get("summary", "Resumen no disponible")).strip(),
                "keywords": parsed_data.get("keywords", []) if isinstance(parsed_data.get("keywords"), list) else [],
                "date": str(parsed_data.get("date", "Fecha no encontrada")).strip(),
            }
        except Exception as e:
            return {
                "title": "Error de procesamiento con OpenAI",
                "summary": f"Error: {str(e)}",
                "keywords": [],
                "date": "Fecha no encontrada",
            }


class DeepSeekService(AIService):
    """Servicio de DeepSeek."""
    
    def __init__(self):
        super().__init__()
        self.model_name = "deepseek-chat"
        self.client = OpenAI(
            api_key=settings.DEEPSEEK_API_KEY,
            base_url="https://api.deepseek.com"
        )
    
    def _call_ai(self, text_content: str) -> Dict[str, Any]:
        try:
            prompt = self._create_analysis_prompt(text_content)
            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": "Eres un asistente experto en análisis de documentos."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=1000,
                temperature=0.7,
                timeout=self.api_timeout
            )
            raw_text = response.choices[0].message.content
            parsed_data = self._parse_response(raw_text)
            
            return {
                "title": str(parsed_data.get("title", "Título no encontrado")).strip(),
                "summary": str(parsed_data.get("summary", "Resumen no disponible")).strip(),
                "keywords": parsed_data.get("keywords", []) if isinstance(parsed_data.get("keywords"), list) else [],
                "date": str(parsed_data.get("date", "Fecha no encontrada")).strip(),
            }
        except Exception as e:
            return {
                "title": "Error de procesamiento con DeepSeek",
                "summary": f"Error: {str(e)}",
                "keywords": [],
                "date": "Fecha no encontrada",
            }


# Registrar proveedores
_AI_PROVIDERS.update({
    "google": GeminiService,
    "openai": OpenAIService,
    "deepseek": DeepSeekService,
})


# ==================================================================================
#                    FUNCIONES PÚBLICAS
# ==================================================================================

def get_ai_service() -> AIService:
    """Obtiene el servicio de IA configurado."""
    try:
        provider = settings.AI_PROVIDER.lower()
        service_class = _AI_PROVIDERS.get(provider)
        
        if not service_class:
            print(f"Proveedor no soportado: {provider}. Usando Gemini.")
            service_class = GeminiService
            
        return service_class()
    except Exception as e:
        print(f"Error configurando servicio de IA: {e}")
        return GeminiService()


def extract_metadata(file_bytes: bytes, filename: str) -> Dict[str, Any]:
    """Función principal para extraer metadatos."""
    try:
        service = get_ai_service()
        return service.extract_metadata(file_bytes, filename)
    except Exception as e:
        print(f"Error extrayendo metadatos: {e}")
        
        # Fallback sin IA
        path = Path(filename)
        return {
            "id": path.stem,
            "filename": filename,
            "file_extension": path.suffix.lower(),
            "file_size_bytes": len(file_bytes),
            "title": f"Documento: {filename}",
            "summary": "Metadatos extraídos sin IA",
            "keywords": [path.suffix.replace(".", ""), "documento"],
            "date": datetime.now().strftime("%Y-%m-%d"),
            "processing_timestamp": datetime.now().isoformat() + "Z",
            "ai_model": "fallback",
            "error": str(e),
            "file_hash": hashlib.sha256(file_bytes).hexdigest()
        }


def get_supported_extensions() -> list[str]:
    """Devuelve las extensiones soportadas."""
    return list(ALLOWED_EXTENSIONS)


def is_supported_file(filename: str) -> bool:
    """Verifica si un archivo es soportado."""
    file_extension = Path(filename).suffix.lower()
    return file_extension in ALLOWED_EXTENSIONS


def estimate_processing_time(file_size_bytes: int) -> int:
    """Estima el tiempo de procesamiento."""
    if file_size_bytes < 100_000:
        return 5
    elif file_size_bytes < 1_000_000:
        return 15
    elif file_size_bytes < 10_000_000:
        return 45
    else:
        return 90