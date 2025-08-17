import React from "react";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";

// Convierte Date a YYYY-MM-DD sin problemas de timezone
const formatDateToLocal = (date) => {
  if (!date) return "";
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

// Convierte YYYY-MM-DD a Date object
const parseDateFromString = (dateString) => {
  if (!dateString) return undefined;
  
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export default function DatePicker({ 
  label, 
  date, 
  onChange, 
  placeholder = "Seleccionar",
  className = "w-[150px]"
}) {
  return (
    <div className="flex flex-col justify-end gap-1">
      {label && (
        <label className="text-sm font-medium text-gray-700">{label}</label>
      )}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={`${className} justify-start text-left font-normal border border-gray-300`}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(parseDateFromString(date), "dd/MM/yyyy") : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={parseDateFromString(date)}
            onSelect={(selected) => {
              if (selected) {
                const localDateString = formatDateToLocal(selected);
                onChange(localDateString);
              }
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}