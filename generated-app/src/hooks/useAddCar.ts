import { useMutation } from "@apollo/client";
import { ADD_CAR, GET_CARS } from "../graphql/queries";
import type { Car } from "../types";

export interface AddCarInput {
  make: string;
  model: string;
  year: number;
  color: string;
}

export interface UseAddCarResult {
  addCar: (input: AddCarInput) => Promise<any>;
  loading: boolean;
  error?: Error;
}

export function useAddCar(): UseAddCarResult {
  const [mutate, { loading, error }] = useMutation<{ addCar: Car }, AddCarInput>(
    ADD_CAR,
    {
      refetchQueries: [{ query: GET_CARS }],
    }
  );

  const addCar = async (input: AddCarInput) => {
    const response = await mutate({ variables: input });
    return response.data?.addCar;
  };

  return {
    addCar,
    loading,
    error: error ? new Error(error.message) : undefined,
  };
}