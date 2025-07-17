import React, { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Newspaper, Search, CalendarDays, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const mockNews = [
  {
    id: 1,
    title: "Firma del acuerdo CDES - Ayuntamiento 2025",
    date: "2025-06-25",
    summary: "Se formalizó el acuerdo de colaboración estratégica para impulsar proyectos del Plan Estratégico Santiago 2030.",
    category: "Acuerdos",
    readTime: "2 min",
    featured: true
  },
  {
    id: 2,
    title: "Lanzamiento de la Biblioteca Pública Digital",
    date: "2025-06-20",
    summary: "Los ciudadanos ya pueden acceder libremente a los documentos habilitados por el CDES desde el nuevo portal público.",
    category: "Comunicados",
    readTime: "3 min"
  },
  {
    id: 3,
    title: "Nueva alianza con universidades locales",
    date: "2025-06-15",
    summary: "El CDES firmó acuerdos con instituciones académicas para investigaciones sobre sostenibilidad urbana.",
    category: "Alianzas",
    readTime: "4 min"
  },
  {
    id: 4,
    title: "Plan de revitalización del centro histórico",
    date: "2025-06-10",
    summary: "Se presentó el plan de acción para la recuperación y puesta en valor del casco histórico de la ciudad.",
    category: "Proyectos",
    readTime: "5 min"
  },

];

const formatDate = (dateString) => {
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return new Date(dateString).toLocaleDateString('es-ES', options);
};

export default function News() {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredNews = mockNews.filter(news =>
    news.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    news.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
    news.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="bg-white text-gray-900 min-h-screen">
        <div className="max-w-6xl mx-auto px-4 py-8">
          {/* Encabezado */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <Newspaper className="h-8 w-8 text-black" />
              <h1 className="text-2xl md:text-3xl font-bold">Noticias Institucionales</h1>
            </div>
            <p className="text-gray-600 max-w-3xl">
              Comunicados, acuerdos y novedades recientes del Consejo Estratégico
            </p>
          </div>

          {/* Barra de búsqueda y filtros */}
          <div className="mb-8 flex flex-col md:flex-row gap-4 justify-between">
            <div className="relative flex-1 max-w-2xl">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <Input
                placeholder="Buscar noticias..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 py-5 border border-gray-300 rounded-lg"
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              {['Todas', 'Acuerdos', 'Comunicados', 'Alianzas', 'Proyectos', 'Informes'].map((cat) => (
                <Badge
                  key={cat}
                  variant={searchTerm === cat ? 'default' : 'outline'}
                  className={`cursor-pointer border-gray-300 ${searchTerm === cat ? 'bg-[#ef4444] text-white' : 'text-gray-700'}`}
                  onClick={() => setSearchTerm(cat === 'Todas' ? '' : cat)}
                >
                  {cat}
                </Badge>
              ))}
            </div>
          </div>

          {/* Noticias destacada */}
          <div className="mb-10">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Destacada</h2>
            {mockNews.filter(n => n.featured).map(news => (
              <Card key={news.id} className="border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                <CardContent className="p-0">
                  <div className="md:flex">
                    <div className="md:w-1/3 bg-gray-100 flex items-center justify-center p-6">
                      <div className="bg-gray-200 border-2 border-dashed rounded-xl w-full h-48" />
                    </div>
                    <div className="md:w-2/3 p-6">
                      <div className="flex justify-between items-start">
                        <div>
                          <Badge className="bg-[#ef4444] text-white mb-2">
                            Destacada
                          </Badge>
                          <h3 className="text-xl font-bold mb-2">{news.title}</h3>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-gray-600 mb-4">
                        <div className="flex items-center gap-1">
                          <CalendarDays className="h-4 w-4" />
                          <span>{formatDate(news.date)}</span>
                        </div>
                        <span>•</span>
                        <span>{news.readTime} de lectura</span>
                      </div>
                      <p className="text-gray-700 mb-4">{news.summary}</p>
                      <div className="flex items-center text-[#ef4444] font-medium">
                        <span>Leer noticia completa</span>
                        <ArrowRight className="h-4 w-4 ml-1 text-[#ef4444]" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Listado de noticias */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800">Últimas noticias</h2>
              <p className="text-gray-600">{filteredNews.length} noticias encontradas</p>
            </div>

            {filteredNews.length === 0 ? (
              <div className="text-center py-12 border border-gray-200 rounded-lg">
                <Newspaper className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500 text-lg">
                  No se encontraron noticias con "{searchTerm}"
                </p>
                <button
                  className="mt-4 text-[#ef4444] hover:underline"
                  onClick={() => setSearchTerm('')}
                >
                  Ver todas las noticias
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredNews.filter(n => !n.featured).map(news => (
                  <Card
                    key={news.id}
                    className="border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow h-full flex flex-col"
                  >
                    <div className="bg-gray-100 h-48 flex items-center justify-center">
                      <div className="bg-gray-200 border-2 border-dashed rounded-xl w-full h-full" />
                    </div>
                    <CardContent className="p-5 flex flex-col flex-grow">
                      <div className="flex justify-between items-start mb-3">
                        <Badge className="bg-gray-100 text-gray-800">
                          {news.category}
                        </Badge>
                        <span className="text-xs text-gray-500">{news.readTime}</span>
                      </div>
                      <h3 className="font-bold text-lg mb-2 line-clamp-2">{news.title}</h3>
                      <div className="flex items-center text-gray-500 text-sm mb-3">
                        <CalendarDays className="h-4 w-4 mr-1" />
                        <span>{formatDate(news.date)}</span>
                      </div>
                      <p className="text-gray-700 mb-4 flex-grow">{news.summary}</p>
                      <div className="flex items-center text-[#ef4444] font-medium mt-auto pt-2 border-t border-gray-100">
                        <span>Leer más</span>
                        <ArrowRight className="h-4 w-4 ml-1 text-[#ef4444]" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
