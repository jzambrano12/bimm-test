import { useQuery, useMutation, useApolloClient } from "@apollo/client";
import { GET_CARS, GET_CAR, ADD_CAR } from "@/graphql/queries";
import type { Car } from "../types";

export interface AddCarInput {
  make: string;
  model: string;
  year: number;
  color: string;
}

export interface UseCarsResult {
  cars: Car[];
  loading: boolean;
  error?: Error;
  addCar: (input: AddCarInput) => Promise<Car | undefined>;
  addingCar: boolean;
  addCarError?: Error;
  getCarById?: (id: string) => { car?: Car; loading: boolean; error?: Error };
}

export function useCars(): UseCarsResult {
  const client = useApolloClient();

  const { data, loading, error } = useQuery<{ cars: Car[] }>(GET_CARS);

  const [mutateAddCar, { loading: addingCar, error: addCarError }] = useMutation<
    { addCar: Car },
    AddCarInput
  >(ADD_CAR, {
    refetchQueries: [{ query: GET_CARS }],
  });

  const addCar = async (input: AddCarInput): Promise<Car | undefined> => {
    try {
      const response = await mutateAddCar({
        variables: input,
      });
      return response.data?.addCar;
    } catch {
      return undefined;
    }
  };

  const getCarById = (id: string): { car?: Car; loading: boolean; error?: Error } => {
    const carFromList = data?.cars.find((car) => car.id === id);
    if (carFromList) {
      return { car: carFromList, loading: false, error: undefined };
    }

    try {
      const cachedData = client.readQuery<{ car: Car }>(
        {
          query: GET_CAR,
          variables: { id },
        }
      );
      if (cachedData?.car) {
        return { car: cachedData.car, loading: false, error: undefined };
      }
    } catch {
      // Fall back if cache read fails
    }

    return {
      car: undefined,
      loading,
      error: error || undefined,
    };
  };

  return {
    cars: data?.cars ?? [],
    loading,
    error: error || undefined,
    addCar,
    addingCar,
    addCarError: addCarError || undefined,
    getCarById,
  };
}
