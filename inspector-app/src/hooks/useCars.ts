import { useQuery } from "@apollo/client";
import { GET_CARS } from "@/graphql/queries";
import type { Car } from "@/types";

export interface UseCarsResult {
  cars: Car[];
  loading: boolean;
  error?: Error;
  refetch: () => void;
}

export function useCars(): UseCarsResult {
  const { data, loading, error, refetch } = useQuery<{ cars: Car[] }>(GET_CARS);

  return {
    cars: data?.cars ?? [],
    loading,
    error: error ? new Error(error.message) : undefined,
    refetch: () => {
      void refetch();
    },
  };
}