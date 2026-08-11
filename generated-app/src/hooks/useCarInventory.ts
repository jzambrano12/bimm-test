import { useQuery, useMutation } from "@apollo/client";
import { GET_CARS, ADD_CAR } from "@/graphql/queries";
import type { Car } from "@/types";

export interface AddCarInput {
  make: string;
  model: string;
  year: number;
  color: string;
}

export interface UseCarInventoryResult {
  cars: Car[];
  loading: boolean;
  error?: Error;
  addCar: (input: AddCarInput) => Promise<void>;
  adding: boolean;
  addError?: Error;
}

export function useCarInventory(): UseCarInventoryResult {
  const { data, loading, error } = useQuery<{ cars: Car[] }>(GET_CARS);

  const [addCarMutation, { loading: adding, error: addError }] = useMutation<
    { addCar: Car },
    AddCarInput
  >(ADD_CAR, {
    refetchQueries: [{ query: GET_CARS }],
    update(cache, { data: mutationData }) {
      if (!mutationData?.addCar) return;
      const existingData = cache.readQuery<{ cars: Car[] }>({ query: GET_CARS });
      if (existingData?.cars) {
        const exists = existingData.cars.some(
          (car) => car.id === mutationData.addCar.id
        );
        if (!exists) {
          cache.writeQuery({
            query: GET_CARS,
            data: {
              cars: [...existingData.cars, mutationData.addCar],
            },
          });
        }
      }
    },
  });

  const addCar = async (input: AddCarInput): Promise<void> => {
    await addCarMutation({ variables: input });
  };

  return {
    cars: data?.cars ?? [],
    loading,
    error,
    addCar,
    adding,
    addError,
  };
}
