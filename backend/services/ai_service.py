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

DOCUMENTOS = {
    "presentaciones": {
        "metadata": ["tema", "descripcion", "secciones_clave", "keywords"],
        "descripcion": "Es una presentacion mayormente guardado en formato .pptx, donde se presenta un tema en cuestion."
    },
    "carta": {
        "metadata": ["tema", "descripcion", "remitente", "destinatario", "fecha_carta",
                        "proposito", "keywords"],
        "descripcion": "Un mensaje mandado de forma profecional que puede tener difersos motivos. mayormente mandado y recibidas de forma fisica."
    },
    "informe": {
        "metadata": ["tema", "audiencia", "secciones_principales", "numero_paginas", 
                        "fecha_informe", "inconsistencias_detectadas", "keywords"],
        "descripcion": " es un documento que presenta de manera ordenada, clara y objetiva información sobre un tema específico. Su propósito principal es comunicar resultados, hallazgos."
    },
    "convenios": {
        "metadata": ["tema", "partes", "objetivos", "fecha_inicio", "duracion", 
                        "Estatus", "clausulas", "fecha_firma", "Confidencial", "keywords"],
        "descripcion": "Es un acuerdo formal entre dos o más partes  mediante en el cual establecen compromisos, colaboraciones o intenciones comunes, sin necesariamente implicar una obligación económica directa o contractual, aunque puede incluirla."
    },
    "contrato": {
        "metadata": ["tema", "partes_involucradas", "tipo_contrato", "fecha_firma",
                        "fecha_inicio", "fecha_fin", "clausulas_principales", "obligaciones", 
                        "keywords"],
        "descripcion": "Es un acuerdo legalmente vinculante entre dos o más partes que establece derechos y obligaciones mutuas."
    },
    "minutas/ayuda_memoria": {
        "metadata": ["tema", "resumen_informe", "fecha_reunion", "hora_inicio", 
                        "actividades_samana", "puntos_claves", "hora_finalizacion", "participantes", 
                        "keywords"],
        "descripcion": "es un documento breve que registra de forma resumida y cronológica los puntos tratados en una reunión. Sirve como registro de lo discutido, lo acordado, quién participó y qué acciones deben realizarse luego del encuentro."
    },
    "actas": {
        "metadata": ["tema", "fecha_reunion", "lugar", "presentes", "resoluciones", 
                        "firmas_presentes", "keywords"],
        "descripcion": "Documento oficial y escrito que registra de forma fiel, objetiva y cronológica los hechos, acuerdos y decisiones ocurridas durante una reunión, sesión"
    },
    "mapas": {
        "metadata": ["lugar", "leyenda", "tipo_mapa", "nodos_principales", "keywords"],
        "descripcion": "Es un documento o visualización que presenta datos espaciales o geográficos de manera estructurada. Mayormente guardados por provincias."
    },
    "logos": {
        "metadata": ["tema", "entidad", "colores", "formas", "tipografia", "simbolismo", "keywords"],
        "descripcion": "Es un símbolo gráfico que representa visualmente la identidad de una marca, empresa, organización o producto."
    },
    "graficos": {
        "metadata": ["tema", "tipo_grafico", "cantida_grafos", "datos_representados", 
                        "ejes", "etiquetas", "keywords"],
        "descripcion": "Una representacion grafica de informacion o datos relaciones, que permite comprender patrones, tendencias, comparaciones o distribuciones de forma más clara y rápida"
    },
    "nota_prensa/comunicaciones": {
        "metadata": ["tema", "organizacion principal", "Ubicacion", "Colaboradores", 
                        "contacto_prensa", "fecha_publicacion", "keywords"],
        "descripcion": "es un texto redactado en formato periodístico que busca difundir información importante, actual y verificable, generalmente sobre eventos, logros, lanzamientos."
    },
    "plan": {
        "metadata": ["tema", "organizacion", "año", "objetivos", "estrategias", "cronograma", 
                        "responsables", "indice", "keywords"],
        "descripcion": "es un documento que define la ejecicion de un proyecto, programa o iniciativa a lo largo de un periodo determinado. Su propósito es establecer objetivos claros, estrategias y acciones específicas para alcanzar metas definidas."
    },
    "ficha_tecnica":{
        "metadata": ["tema", "Descripcion", "justificacion", "objetivos", "poblacion beneficiaria", 
                        "actores estrategicos", "plazos de ejecucion", "presupuesto estumado", "fecha_extraccion", "keywords"],
        "descripcion":"Es un documento estructurado que resume de manera clara, concisa y organizada la información esencial de un proyecto, evento, producto, servicio o iniciativa. Su propósito es proporcionar datos clave para facilitar la comprensión."
    },
    "estudio":{
        "metadata": ["tema", "titulo", "objetivo", "Descripcion", "metodologia", "fecha_publicacion", 
                        "autor", "numero_paginas", "fecha_extraccion", "keywords"],
        "descripcion":"Un análisis sistemático y detallado sobre un tema, fenómeno o problema específico, realizado con el objetivo de comprenderlo, evaluarlo o proponer soluciones."
    },
    "video":{
        "metadata": ["tema", "duracion_segundos", "resolucion", "fecha_grabacion", "autor", 
                        "formato_video", "tamano_mb", "fecha_extraccion", "keywords"],
        "descripcion":"un video posiblemente promocional o de algun evento."
    },
    "foto":{
        "metadata": ["tema", "resolucion", "fecha_captura", "autor", "formato_imagen", "tamano_mb", 
                        "fecha_extraccion", "keywords"],
        "descripcion":"una foto posiblemente promocional o de algun evento."
    },
    "discursos":{
        "metadata": ["tema", "orador", "afiliacion", "resumen", "fecha_extraccion", "keywords"],
        "descripcion":"una foto posiblemente promocional o de algun evento."
    },
    "memorias institucionales":{
        "metadata": ["temas", "institucion", "periodo", "fecha_extraccion", "keywords"],
        "descripcion":"es un documento que adberga los eventos mas importante que pasaron en un periodo de tiempo, para tener un registro mas ordenados de estos"
    },
    "convocatorias":{
        "metadata": ["descripcion", "tipo", "temas", "medio_confirmacion", 
                        "Entidad_convocada", "fecha_citacion", "ubicacion", "fecha_extraccion", "keywords"],
        "descripcion":"son los datos estructurados que describen sus características, contexto y contenido, facilitando su organización, búsqueda, análisis y seguimiento."
    },
    "Invitacion":{
        "metadata": ["descripcion", "evento", "emisor", "destinatario", "fecha_invitacion", 
                        "fecha_extraccion", "keywords"],
        "descripcion":" es un documento o mensaje formal o informal, emitido por una persona, institución o entidad, con el propósito de convocar, solicitar o animar la participación de una o más personas a un evento, actividad, reunión, proceso o acto específico."
    },
    "cuestionario/ instrumento de recolección de datos":{
        "metadata": ["objetivo", "actores", "tipo", "unidad_analisis", "tipo_datos", "preguntas", 
                        "fecha_extraccion", "keywords"],
        "descripcion":"es una herramienta diseñada para obtener información relevante, válida y confiable de una población, muestra o unidad de análisis. Estos instrumentos permiten captar datos cuantitativos o cualitativos según el objetivo de una investigación o diagnóstico."
    },
    "TDER":{
        "metadata": ["proyecto", "instalacion", "lugar_ejecucion", "duracion", "objetivos", 
                        "actividades", "fecha_extraccion", "keywords"],
        "descripcion":"El TDR establece las bases para la contratación de un consultor especializado en geomática y producción cartográfica, con el fin de instalar y poner en funcionamiento un laboratorio cartográfico municipal. Incluye actividades como diagnóstico de capacidades técnicas y equipos, formulación de recomendaciones organizativas y tecnológicas, y capacitación del personal."
    },
    "cronograma": {
        "metadata": ["evento", "descripcion", "Objetivos", "responsable", "fecha_cronograma", 
                        "fecha_extraccion", "keywords"],
        "descripcion": "Es un documento que presenta un calendario de actividades o eventos, con el objetivo de organizar y planificar el tiempo de manera efectiva."
    },
    "diagnostico":{
        "metadata": ["tema", "institucion_responsable", "resumen", "region", "principales_hallazgos", 
                        "estado", "fecha_extraccion", "keywords"],
        "descripcion":"es un informe o análisis que evalúa el estado actual de la participación, derechos, deberes, organización y condiciones socio-políticas de la población dentro de un territorio."
    },
    "listado":{
        "metadata": ["tema", "descripcion", "elementos", "fecha_extraccion", "keywords"],
        "descripcion":"es un documento que presenta una relación ordenada y estructurada de elementos, objetos, personas o conceptos relacionados con un tema específico. Su propósito es organizar y presentar información de manera clara y accesible."
    },
    "declaracion ciudadana":{
        "metadata": ["descripcion", "categoria de listado", "fecha_captura", "fecha_extraccion", 
                        "keywords"],
        "descripcion":"es un documento que establece los principios y compromisos de una comunidad o grupo en relación con un tema específico, buscando promover la participación ciudadana y la transparencia en la gestión pública."
    },
    "agendas": {
        "metadata": ["tipo_archivo", "tema", "puntos_importantes", "fecha_reunion", "tiempo_inicio",
                        "tiempo_finalizacion", "participantes", "fecha_cargado", "keywords"],
        "descripcion": "Es un documento en el que se presenta la agenda de un evento, con sus participantes, fecha del evento y duracion estima tanto de inicio como de finalizacion "
    }
}

def is_large_file(file_size_bytes: int) -> bool:
    # No usamos un umbral para archivos grandes, todos se procesarán de la misma manera
    # Esto asegura que todos los archivos se envíen completos a Gemini
    return True

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
        """Intenta extraer un objeto JSON válido de la respuesta de la IA."""
        import json
        import re
        
        # Log para depuración
        print(f"Analizando respuesta ({len(raw_response)} caracteres)")
        
        try:
            # Intento 1: Parsear directamente como JSON
            data = json.loads(raw_response.strip())
            if isinstance(data, dict):
                print("Respuesta analizada como JSON directamente")
                return data
        except json.JSONDecodeError:
            print("No es JSON válido directamente, probando otras opciones...")
            pass

        # Intento 2: Buscar JSON dentro de bloques de código
        json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', raw_response, re.DOTALL)
        if json_match:
            try:
                data = json.loads(json_match.group(1).strip())
                if isinstance(data, dict):
                    print("Respuesta extraída de bloque de código")
                    return data
            except json.JSONDecodeError:
                print("Error al analizar JSON en bloque de código")
                pass

        # Intento 3: Buscar el primer par de llaves
        start_brace = raw_response.find('{')
        end_brace = raw_response.rfind('}')

        if start_brace != -1 and end_brace != -1 and start_brace < end_brace:
            try:
                data = json.loads(raw_response[start_brace:end_brace + 1])
                if isinstance(data, dict):
                    print("Respuesta extraída de llaves en texto")
                    return data
            except json.JSONDecodeError:
                print("Error al analizar JSON con llaves en texto")
                pass

        # Fallback: Si no pudimos extraer JSON, devolvemos un objeto por defecto
        print("No se pudo extraer JSON, usando valores predeterminados")
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
        import uuid
        try:
            path = Path(filename)
            file_extension = path.suffix.lower()
            file_id = f"doc_{uuid.uuid4()}"
            
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
            file_id = f"doc_{uuid.uuid4()}"
            return {
                "id": file_id,
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
        # Aumentamos el timeout para la API
        self.api_timeout = 300  # 5 minutos para casos extremos
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
        """Sube bytes a Gemini usando el método soportado para la versión actual del SDK."""
        import tempfile
        import os as _os
        import time
        tmp_path = None
        
        try:
            # Escribimos a un archivo temporal para usar el arg soportado 'path'
            with tempfile.NamedTemporaryFile(delete=False, suffix=Path(filename).suffix) as tmp:
                tmp.write(file_bytes)
                tmp.flush()
                tmp_path = tmp.name
                
            print(f"Archivo temporal creado: {tmp_path} ({_os.path.getsize(tmp_path)/1024/1024:.2f} MB)")
            
            # Intentamos determinar la versión del SDK de genai
            genai_version = getattr(genai, "__version__", "0.0.0")
            print(f"Usando genai versión: {genai_version}")
            
            # Usamos los parámetros correctos según la versión
            try:
                # Método para versiones recientes (>=0.6.0)
                uploaded_file = genai.upload_file(
                    path=tmp_path,
                    display_name=filename,
                    mime_type=mime_type
                )
                print(f"Archivo subido con nueva API: {getattr(uploaded_file, 'name', 'unknown')}")
            except TypeError as e:
                # Si falla por TypeError, probamos con la API anterior
                print(f"Error con API nueva: {e}, probando API anterior...")
                uploaded_file = genai.upload_file(
                    file_path=tmp_path,
                    display_name=filename
                )
                print(f"Archivo subido con API anterior: {getattr(uploaded_file, 'name', 'unknown')}")
                
            # Esperar a que se procese el archivo (máximo 30 segundos)
            state = "UNKNOWN"
            for i in range(30):
                # Intentar obtener el estado actual
                try:
                    if hasattr(uploaded_file, "state"):
                        if hasattr(uploaded_file.state, "name"):
                            state = uploaded_file.state.name
                        else:
                            state = str(uploaded_file.state)
                    else:
                        # Intentar obtener el estado mediante get_file
                        updated_file = genai.get_file(uploaded_file.name)
                        if hasattr(updated_file, "state"):
                            if hasattr(updated_file.state, "name"):
                                state = updated_file.state.name
                            else:
                                state = str(updated_file.state)
                        else:
                            state = "UNKNOWN"
                    
                    print(f"Estado del archivo: {state}")
                    
                    # Si está activo, podemos usarlo
                    if state == "ACTIVE":
                        return uploaded_file
                    # Si falló, lanzamos error
                    elif state == "FAILED":
                        raise ValueError(f"Falló el procesamiento del archivo: {state}")
                    # Si está procesando, esperamos
                    elif state == "PROCESSING":
                        time.sleep(1)
                        continue
                    else:
                        # Estado desconocido, seguimos esperando
                        time.sleep(1)
                        continue
                except Exception as e:
                    print(f"Error verificando estado: {e}")
                    time.sleep(1)
                    continue
            
            # Si llegamos aquí, continuamos con el archivo tal como está
            print("Tiempo de espera agotado, continuando con el archivo...")
            return uploaded_file
            
        finally:
            # Limpiamos el archivo temporal
            if tmp_path and _os.path.exists(tmp_path):
                try:
                    _os.unlink(tmp_path)
                    print(f"Archivo temporal eliminado: {tmp_path}")
                except Exception as e:
                    print(f"Error eliminando archivo temporal: {e}")
    
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
                
                # En este caso, añadimos el contenido extraído al prompt
                enhanced_prompt = f"{prompt}\n\nContenido del archivo:\n{extracted_text[:5000]}..."
                
                # Usamos solo el prompt para la generación (sin archivos)
                response = self.model.generate_content(
                    enhanced_prompt,
                    request_options={"timeout": self.api_timeout}
                )
            else:
                # Para PDFs y otros archivos binarios
                mime_type = self._get_mime_type(filename)
                print(f"Procesando archivo {filename} ({len(file_bytes)/1024/1024:.2f} MB) como {mime_type}")
                
                # Subir y usar el archivo
                uploaded_file = self._upload_to_gemini(file_bytes, filename, mime_type)
                print(f"Archivo subido exitosamente: {getattr(uploaded_file, 'name', 'desconocido')}")
                
                try:
                    # Crear un objeto "Part" para el prompt
                    text_part = prompt
                    
                    # Generar contenido con un timeout extendido para archivos grandes
                    print(f"Generando contenido con Gemini para {filename}")
                    
                    # En 0.8.x la forma recomendada es pasar [uploaded_file, prompt]
                    response = self.model.generate_content(
                        [uploaded_file, text_part],
                        request_options={"timeout": self.api_timeout}
                    )
                    
                    print(f"Contenido generado exitosamente para {filename}")
                finally:
                    # Intentar limpiar el archivo subido
                    try:
                        if hasattr(genai, 'delete_file') and hasattr(uploaded_file, 'name'):
                            genai.delete_file(uploaded_file.name)
                            print(f"Archivo eliminado de Gemini: {uploaded_file.name}")
                    except Exception as cleanup_error:
                        print(f"Error al limpiar archivo en Gemini: {cleanup_error}")
            
            # Procesar respuesta
            raw_text = response.text
            print(f"Respuesta recibida, longitud: {len(raw_text)} caracteres")
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