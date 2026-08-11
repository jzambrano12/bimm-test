import { useQuery, useMutation } from "@apollo/client";
import { GET_CARS, ADD_CAR } from "../graphql/queries";
import { Car } from "../types";

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
      refetch();
    },
  };
}

export interface AddCarInput {
  make: string;
  model: string;
  year: number;
  color: string;
}

export interface UseAddCarResult {
  addCar: (input: AddCarInput) => Promise<void>;
  loading: boolean;
  error?: Error;
}

export function useAddCar(): UseAddCarResult {
  const [mutate, { loading, error }] = useMutation<{ addCar: Car }, AddCarInput>(ADD_CAR, {
    refetchQueries: [{ query: GET_CARS }],
  });

  const addCar = async (input: AddCarInput): Promise<void> => {
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
