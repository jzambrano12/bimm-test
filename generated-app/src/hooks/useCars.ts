import { useQuery, useMutation } from "@apollo/client";
import { GET_CARS, ADD_CAR } from "@/graphql/queries";
import type { Car } from "@/types";

export interface UseCarsResult {
  cars: Car[];
  loading: boolean;
  error?: Error;
  addCar: (input: { make: string; model: string; year: number; color: string }) => Promise<void>;
  addCarLoading: boolean;
}

export function useCars(): UseCarsResult {
  const { data, loading, error } = useQuery<{ cars: Car[] }>(GET_CARS);

  const [mutateAddCar, { loading: addCarLoading }] = useMutation<{ addCar: Car }, { make: string; model: string; year: number; color: string }>(ADD_CAR, {
    refetchQueries: [{ query: GET_CARS }],
    awaitRefetchQueries: true,
  });

  const addCar = async (input: { make: string; model: string; year: number; color: string }): Promise<void> => {
    await mutateAddCar({
      variables: input,
    });
  };

  return {
    cars: data?.cars ?? [],
    loading,
    error: error ? new Error(error.message) : undefined,
    addCar,
    addCarLoading,
  };
}
