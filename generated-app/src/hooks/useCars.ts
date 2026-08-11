import { useQuery, useMutation } from "@apollo/client";
import { GET_CARS, ADD_CAR } from "@/graphql/queries";
import type { Car } from "../types";

export interface UseCarsResult {
  cars: Car[];
  loading: boolean;
  error?: Error;
  refetch: () => void;
}

export interface UseAddCarResult {
  addCar: (input: {
    make: string;
    model: string;
    year: number;
    color: string;
  }) => Promise<void>;
  loading: boolean;
  error?: Error;
}

export function useCars(): UseCarsResult {
  const { data, loading, error, refetch } = useQuery<{ cars: Car[] }>(GET_CARS);

  return {
    cars: data?.cars ?? [],
    loading,
    error: error ? new Error(error.message) : undefined,
    refetch: () => {
      refetch();
    },
  };
}

export function useAddCar(): UseAddCarResult {
  const [mutate, { loading, error }] = useMutation(ADD_CAR, {
    refetchQueries: [{ query: GET_CARS }],
  });

  const addCar = async (input: {
    make: string;
    model: string;
    year: number;
    color: string;
  }): Promise<void> => {
    await mutate({
      variables: input,
    });
  };

  return {
    addCar,
    loading,
    error: error ? new Error(error.message) : undefined,
  };
}
