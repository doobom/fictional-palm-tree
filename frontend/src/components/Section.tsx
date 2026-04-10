// frontend/src/components/Section.tsx
import React from 'react';
import { ChevronDown } from 'lucide-react';

export interface SectionProps {
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, icon, isOpen, onToggle, children }) => {
  return (
    <section className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mb-4">
      <button 
        onClick={onToggle} 
        className="w-full flex justify-between items-center p-5 bg-white active:bg-gray-50 outline-none transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="text-gray-600">{icon}</div>
          <h3 className="text-lg font-bold text-gray-800">{title}</h3>
        </div>
        <ChevronDown className={`text-gray-400 transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <div className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="p-5 pt-0 border-t border-gray-50">
          {children}
        </div>
      </div>
    </section>
  );
};

export default Section;