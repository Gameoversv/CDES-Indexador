export const documentTypesByRole = {
  admin: [
    "presentaciones", "carta", "informe", "convenios", "contrato", 
    "minutas/ayuda_memoria", "actas", "mapas", "logos", "graficos", 
    "nota_prensa/comunicaciones", "plan", "ficha_tecnica", "estudio", 
    "video", "foto", "discursos", "memorias institucionales", 
    "convocatorias", "Invitacion", "cuestionario/ instrumento de recolección de datos", 
    "TDER", "cronograma", "diagnostico", "listado", "declaracion ciudadana"
  ],
  CoordinadorPlanificacion: [
    "presentaciones", "carta", "informe", "convenios", "contrato", 
    "minutas/ayuda_memoria", "actas", "mapas", "logos", "graficos", 
    "nota_prensa/comunicaciones", "plan", "ficha_tecnica", "estudio", 
    "video", "foto", "discursos", "memorias institucionales", 
    "convocatorias", "Invitacion", "cuestionario/ instrumento de recolección de datos", 
    "TDER", "cronograma", "diagnostico", "listado", "declaracion ciudadana"
  ],
  UnidadProyectos: [
    "presentaciones", "informe", "minutas/ayuda_memoria", "actas", "mapas", 
    "logos", "graficos", "plan", "ficha_tecnica", "estudio", "video", "foto", 
    "memorias institucionales", "Invitacion", "cuestionario/ instrumento de recolección de datos", 
    "TDER", "cronograma", "diagnostico", "listado", "declaracion ciudadana"
  ],
  UnidadPlanificacion: [
    "presentaciones", "informe", "minutas/ayuda_memoria", "actas", "mapas", 
    "logos", "graficos", "plan", "ficha_tecnica", "estudio", "video", "foto", 
    "memorias institucionales", "Invitacion", "cuestionario/ instrumento de recolección de datos", 
    "TDER", "cronograma", "diagnostico", "listado", "declaracion ciudadana"
  ],
  asistenciaGeneral: [
    "agendas", "carta", "minutas/ayuda_memoria", "logos", "convocatorias"
  ],
  UnidadAdministrativa: [
    "convenio", "contrato", "plan"
  ],
  UnidadComunicacion: [
    "nota_prensa/comunicaciones", "video", "foto", "convocatorias", 
    "Invitacion", "cronograma"
  ]
};

export const getAllDocumentTypes = () => {
  return [...new Set(Object.values(documentTypesByRole).flat())].sort();
};

export const formatDocumentType = (type) => {
  if (!type) return "";
  return type
    .replace(/_/g, " ")
    .split(/([ /])/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
};

export const fileExtensionTypes = [
  { value: "pdf", label: "PDF" },
  { value: "docx", label: "Word (DOCX)" },
  { value: "xlsx", label: "Excel (XLSX)" },
  { value: "pptx", label: "PowerPoint (PPTX)" },
];