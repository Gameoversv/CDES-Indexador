from __future__ import annotations

import json
import re
import hashlib
import io
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional
from abc import ABC, abstractmethod

from docx import Document
from openpyxl import load_workbook
from pptx import Presentation

import google.generativeai as genai
from openai import OpenAI

from config import settings

ALLOWED_EXTENSIONS = {'.pdf', '.docx', '.pptx', '.xlsx', '.txt', '.md', '.png', '.jpg', '.jpeg', '.mp3', '.mp4'}

_AI_PROVIDERS: Dict[str, type["AIService"]] = {}

def is_large_file(file_size_bytes: int) -> bool:
    return file_size_bytes > 20 * 1024 * 1024

class AIService(ABC):
    def __init__(self):
        self.max_summary_words = settings.MAX_SUMMARY_WORDS
        self.max_keywords = settings.MAX_KEYWORDS
        self.api_timeout = settings.API_TIMEOUT
        self.model_name = "unknown"
    
    def _create_analysis_prompt(self) -> str:
        return f"""
Analiza este documento y extrae los siguientes metadatos en formato JSON estricto:

1. "title": Título principal o tema central del documento.
2. "summary": Resumen conciso de máximo {self.max_summary_words} palabras.
3. "keywords": Entre 5 y {self.max_keywords} palabras clave relevantes.
4. "date": Fecha más significativa en formato YYYY-MM-DD o "Fecha no encontrada".

IMPORTANTE: Responde ÚNICAMENTE con el objeto JSON, sin bloques de código markdown ni texto adicional.
"""
    
    def _parse_response(self, raw_response: str) -> Dict[str, Any]:
        try:
            data = json.loads(raw_response.strip())
            if isinstance(data, dict):
                return data
        except json.JSONDecodeError:
            pass
        
        json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', raw_response, re.DOTALL)
        if json_match:
            try:
                data = json.loads(json_match.group(1).strip())
                if isinstance(data, dict):
                    return data
            except json.JSONDecodeError:
                pass
        
        start_brace = raw_response.find('{')
        end_brace = raw_response.rfind('}')
        
        if start_brace != -1 and end_brace != -1 and start_brace < end_brace:
            try:
                data = json.loads(raw_response[start_brace:end_brace + 1])
                if isinstance(data, dict):
                    return data
            except json.JSONDecodeError:
                pass
        
        return {
            "title": "Error de parseo",
            "summary": "No se pudo extraer el resumen.",
            "keywords": [],
            "date": "Fecha no encontrada"
        }
    
    @abstractmethod
    def _process_file(self, file_bytes: bytes, filename: str) -> Dict[str, Any]:
        pass
    
    def extract_metadata(self, file_bytes: bytes, filename: str) -> Dict[str, Any]:
        try:
            path = Path(filename)
            file_extension = path.suffix.lower()
            file_id = path.stem
            
            ai_metadata = self._process_file(file_bytes, filename)
            
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
                "file_hash": file_hash
            }
        except Exception as e:
            return {
                "id": Path(filename).stem,
                "filename": filename,
                "file_extension": Path(filename).suffix.lower(),
                "file_size_bytes": len(file_bytes),
                "title": f"Error procesando {filename}",
                "summary": "No se pudieron extraer metadatos debido a un error.",
                "keywords": [],
                "date": "Fecha no encontrada",
                "processing_timestamp": datetime.now().isoformat() + "Z",
                "error": str(e),
                "file_hash": hashlib.sha256(file_bytes).hexdigest()
            }


class GeminiService(AIService):
    def __init__(self):
        super().__init__()
        self.model_name = "gemini-1.5-flash-latest"
        genai.configure(api_key=settings.GEMINI_API_KEY)
        self.model = genai.GenerativeModel(self.model_name)

    def _extract_text_from_office_doc(self, file_bytes: bytes, extension: str) -> str:
        text_content = []
        try:
            bytes_io = io.BytesIO(file_bytes)
            if extension == '.docx':
                doc = Document(bytes_io)
                for para in doc.paragraphs:
                    text_content.append(para.text)
            elif extension == '.xlsx':
                workbook = load_workbook(filename=bytes_io, read_only=True)
                for sheet in workbook.worksheets:
                    for row in sheet.iter_rows():
                        for cell in row:
                            if cell.value:
                                text_content.append(str(cell.value))
            elif extension == '.pptx':
                prs = Presentation(bytes_io)
                for slide in prs.slides:
                    for shape in slide.shapes:
                        if hasattr(shape, "text"):
                            text_content.append(shape.text)
            return "\n".join(text_content)
        except Exception as e:
            print(f"No se pudo extraer texto para {extension}: {e}")
            return ""

    def _upload_to_gemini(self, file_bytes: bytes, filename: str, mime_type: str) -> genai.File:
        uploaded_file = genai.upload_file(
            path=None,
            display_name=filename,
            mime_type=mime_type,
            file=file_bytes
        )
        
        while uploaded_file.state.name == "PROCESSING":
            import time
            time.sleep(1)
            uploaded_file = genai.get_file(uploaded_file.name)
        
        if uploaded_file.state.name == "FAILED":
            raise ValueError(f"Error subiendo archivo a Gemini: {uploaded_file.state.name}")
            
        return uploaded_file
    
    def _get_mime_type(self, filename: str) -> str:
        ext = Path(filename).suffix.lower()
        mime_types = {
            '.pdf': 'application/pdf',
            '.txt': 'text/plain',
            '.md': 'text/markdown',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.mp3': 'audio/mpeg',
            '.mp4': 'video/mp4',
        }
        return mime_types.get(ext, 'application/octet-stream')
    
    def _process_file(self, file_bytes: bytes, filename: str) -> Dict[str, Any]:
        try:
            prompt = self._create_analysis_prompt()
            
            extension = Path(filename).suffix.lower()
            unsupported_office_ext = ['.docx', '.xlsx', '.pptx']
            
            if extension in unsupported_office_ext:
                print(f"Convirtiendo archivo Office '{filename}' a texto.")
                extracted_text = self._extract_text_from_office_doc(file_bytes, extension)
                if not extracted_text:
                    raise ValueError(f"El archivo '{filename}' está vacío o no se pudo extraer texto.")
                
                file_bytes_for_ai = extracted_text.encode('utf-8')
                mime_type = 'text/plain'
            else:
                file_bytes_for_ai = file_bytes
                mime_type = self._get_mime_type(filename)

            if is_large_file(len(file_bytes_for_ai)):
                uploaded_file = self._upload_to_gemini(file_bytes_for_ai, filename, mime_type)
                response = self.model.generate_content([uploaded_file, prompt])
                genai.delete_file(uploaded_file.name)
            else:
                file_data = {
                    "mime_type": mime_type,
                    "data": file_bytes_for_ai
                }
                response = self.model.generate_content([file_data, prompt])
            
            raw_text = response.text
            parsed_data = self._parse_response(raw_text)
            
            return {
                "title": str(parsed_data.get("title", "Título no encontrado")).strip(),
                "summary": str(parsed_data.get("summary", "Resumen no disponible")).strip(),
                "keywords": parsed_data.get("keywords", []) if isinstance(parsed_data.get("keywords"), list) else [],
                "date": str(parsed_data.get("date", "Fecha no encontrada")).strip(),
            }
        except Exception as e:
            print(f"Error en _process_file: {e}")
            return {
                "title": "Error de procesamiento con Gemini",
                "summary": f"Error: {str(e)}",
                "keywords": [],
                "date": "Fecha no encontrada",
            }

class OpenAIService(AIService):
    def __init__(self):
        super().__init__()
        self.model_name = "gpt-4o-mini"
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
    
    def _process_file(self, file_bytes: bytes, filename: str) -> Dict[str, Any]:
        try:
            import base64
            
            file_base64 = base64.b64encode(file_bytes).decode('utf-8')
            
            prompt = self._create_analysis_prompt()
            
            messages = [
                {
                    "role": "system", 
                    "content": "Eres un asistente experto en análisis de documentos."
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": f"Archivo: {filename}\n\n{prompt}"
                        }
                    ]
                }
            ]
            
            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=messages,
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
    def __init__(self):
        super().__init__()
        self.model_name = "deepseek-chat"
        self.client = OpenAI(
            api_key=settings.DEEPSEEK_API_KEY,
            base_url="https://api.deepseek.com"
        )
    
    def _process_file(self, file_bytes: bytes, filename: str) -> Dict[str, Any]:
        try:
            prompt = self._create_analysis_prompt()
            
            messages = [
                {
                    "role": "system",
                    "content": "Eres un asistente experto en análisis de documentos."
                },
                {
                    "role": "user",
                    "content": f"Archivo: {filename}\n\n{prompt}\n\nNOTA: El archivo ha sido proporcionado pero no puedo acceder directamente a su contenido binario. Por favor, proporciona metadatos genéricos basados en el nombre del archivo."
                }
            ]
            
            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=messages,
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


_AI_PROVIDERS.update({
    "google": GeminiService,
    "openai": OpenAIService,
    "deepseek": DeepSeekService,
})


def get_ai_service() -> AIService:
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
    try:
        service = get_ai_service()
        return service.extract_metadata(file_bytes, filename)
    except Exception as e:
        print(f"Error extrayendo metadatos con IA: {e}")
        path = Path(filename)
        file_extension = path.suffix.lower()
        file_id = path.stem
        
        return {
            "id": file_id,
            "filename": filename,
            "file_extension": file_extension,
            "file_size_bytes": len(file_bytes),
            "title": f"Documento: {filename}",
            "summary": "Metadatos extraídos sin IA debido a error de configuración",
            "keywords": [file_extension.replace(".", ""), "documento"],
            "date": datetime.now().strftime("%Y-%m-%d"),
            "processing_timestamp": datetime.now().isoformat() + "Z",
            "ai_model": "fallback",
            "error": str(e),
            "file_hash": hashlib.sha256(file_bytes).hexdigest()
        }


def get_supported_extensions() -> list[str]:
    return list(ALLOWED_EXTENSIONS)


def is_supported_file(filename: str) -> bool:
    file_extension = Path(filename).suffix.lower()
    return file_extension in ALLOWED_EXTENSIONS


def estimate_processing_time(file_size_bytes: int) -> int:
    if file_size_bytes < 100_000:
        return 5
    elif file_size_bytes < 1_000_000:
        return 15
    elif file_size_bytes < 10_000_000:
        return 45
    else:
        return 90