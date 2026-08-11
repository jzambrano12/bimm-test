import { useState, useMemo } from 'react';
import type { Car } from '@/types';

export type SortOption = 'make-asc' | 'year-desc';

export interface UseCarFilterSortOptions {
  cars: Car[];
}

export interface UseCarFilterSortResult {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedYear: string;
  setSelectedYear: (year: string) => void;
  sortBy: SortOption;
  setSortBy: (sort: SortOption) => void;
  filteredAndSortedCars: Car[];
  availableYears: number[];
}

export function useCarFilterSort({
  cars,
}: UseCarFilterSortOptions): UseCarFilterSortResult {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('make-asc');

  const availableYears = useMemo(() => {
    const years = Array.from(new Set(cars.map((car) => car.year)));
    return years.sort((a, b) => b - a);
  }, [cars]);

  const filteredAndSortedCars = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const filtered = cars.filter((car) => {
      const matchesModel = !query || car.model.toLowerCase().includes(query);
      const matchesYear =
        !selectedYear ||
        selectedYear === 'all' ||
        car.year.toString() === selectedYear;
      return matchesModel && matchesYear;
    });

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'make-asc': {
          const makeCompare = a.make.localeCompare(b.make);
          return makeCompare !== 0 ? makeCompare : a.model.localeCompare(b.model);
        }
        case 'year-desc':
          return b.year - a.year;
        default:
          return 0;
      }
    });
  }, [cars, searchQuery, selectedYear, sortBy]);

  return {
    searchQuery,
    setSearchQuery,
    selectedYear,
    setSelectedYear,
    sortBy,
    setSortBy,
    filteredAndSortedCars,
    availableYears,
  };
}
