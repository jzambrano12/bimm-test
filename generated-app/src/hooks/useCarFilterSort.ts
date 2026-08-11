import type { Car } from "@/types";

export type SortOption = "year-desc" | "make-asc";

export interface UseCarFilterSortProps {
  cars: Car[];
  searchModel: string;
  sortBy: SortOption;
}

export function useCarFilterSort(props: UseCarFilterSortProps): Car[] {
  const { cars, searchModel, sortBy } = props;

  const normalizedSearch = searchModel.trim().toLowerCase();

  const filtered = cars.filter((car) => {
    if (!normalizedSearch) return true;
    return car.model.toLowerCase().includes(normalizedSearch);
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "year-desc") {
      return b.year - a.year;
    }
    if (sortBy === "make-asc") {
      return a.make.localeCompare(b.make, undefined, { sensitivity: "base" });
    }
    return 0;
  });

  return sorted;
}
