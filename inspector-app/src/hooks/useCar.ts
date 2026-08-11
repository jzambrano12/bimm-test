import { useState, useEffect } from "react";
import { useLazyQuery } from "@apollo/client";
import { GET_CAR } from "../graphql/queries";
import type { Car } from "../types";

export interface UseCarResult {
  car?: Car;
  loading: boolean;
  error?: Error;
  durationMs: number;
}

export function useCar(id: string | null): UseCarResult {
  const [car, setCar] = useState<Car | undefined>(undefined);
  const [durationMs, setDurationMs] = useState<number>(0);
  const [fetchCar, { loading, error }] = useLazyQuery<{ car: Car }>(GET_CAR, {
    fetchPolicy: "network-only",
  });

  useEffect(() => {
    if (!id) {
      setCar(undefined);
      setDurationMs(0);
      return;
    }

    const startTime = performance.now();
    fetchCar({
      variables: { id },
    }).then(
      (res) => {
        const endTime = performance.now();
        setDurationMs(Math.round(endTime - startTime));
        if (res.data?.car) {
          setCar(res.data.car);
        } else {
          setCar(undefined);
        }
      },
      () => {
        const endTime = performance.now();
        setDurationMs(Math.round(endTime - startTime));
        setCar(undefined);
      }
    );
  }, [id, fetchCar]);

  return {
    car,
    loading,
    error: error ? new Error(error.message) : undefined,
    durationMs,
  };
}