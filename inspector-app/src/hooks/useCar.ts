import { useState, useEffect } from "react";
import { useLazyQuery } from "@apollo/client";
import { GET_CAR } from "@/graphql/queries";
import type { Car } from "@/types";

export interface UseCarResult {
  car?: Car;
  loading: boolean;
  error?: Error;
  durationMs: number;
  refetch: () => void;
}

export function useCar(id: string | null): UseCarResult {
  const [durationMs, setDurationMs] = useState<number>(0);
  const [startTime, setStartTime] = useState<number | null>(null);

  const [fetchCar, { data, loading, error, refetch: apolloRefetch }] = useLazyQuery<{
    car: Car;
  }>(GET_CAR);

  useEffect(() => {
    if (!id) {
      setDurationMs(0);
      setStartTime(null);
      return;
    }

    const now = performance.now();
    setStartTime(now);
    setDurationMs(0);
    fetchCar({ variables: { id } });
  }, [id, fetchCar]);

  useEffect(() => {
    if (!loading && startTime !== null) {
      const elapsed = performance.now() - startTime;
      setDurationMs(Math.round(elapsed));
    }
  }, [loading, startTime]);

  const refetch = () => {
    if (!id) return;
    const now = performance.now();
    setStartTime(now);
    apolloRefetch({ id });
  };

  return {
    car: data?.car,
    loading,
    error: error ? new Error(error.message) : undefined,
    durationMs,
    refetch,
  };
}
