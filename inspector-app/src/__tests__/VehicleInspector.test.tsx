import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockedProvider } from "@apollo/client/testing";
import { describe, it, expect } from "vitest";
import { GET_CARS, GET_CAR } from "@/graphql/queries";
import { VehicleInspector } from "@/components/VehicleInspector";

const mockCars = [
  {
    id: "1",
    make: "Toyota",
    model: "Camry",
    year: 2024,
    color: "Silver",
    mobile: "https://placehold.co/640x360",
    tablet: "https://placehold.co/1023x576",
    desktop: "https://placehold.co/1440x810",
  },
  {
    id: "2",
    make: "Honda",
    model: "Accord",
    year: 2023,
    color: "Black",
    mobile: "https://placehold.co/640x360",
    tablet: "https://placehold.co/1023x576",
    desktop: "https://placehold.co/1440x810",
  },
];

const mockCarsWithTypename = mockCars.map((car) => ({
  ...car,
  __typename: "Car" as const,
}));

const mocks = [
  {
    request: { query: GET_CARS },
    result: { data: { cars: mockCarsWithTypename } },
  },
  {
    request: { query: GET_CAR, variables: { id: "1" } },
    result: { data: { car: mockCarsWithTypename[0] } },
  },
  {
    request: { query: GET_CAR, variables: { id: "2" } },
    error: new Error("Network error: Failed to fetch single vehicle"),
  },
];

describe("VehicleInspector integration", () => {
  it("asserts list renders items returned by API", async () => {
    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <VehicleInspector />
      </MockedProvider>
    );

    expect(await screen.findByText(/2024 Toyota Camry/i)).toBeInTheDocument();
    expect(screen.getByText(/2023 Honda Accord/i)).toBeInTheDocument();
  });

  it("asserts selecting a vehicle triggers single vehicle request", async () => {
    const user = userEvent.setup();
    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <VehicleInspector />
      </MockedProvider>
    );

    const carItem = await screen.findByText(/2024 Toyota Camry/i);
    await user.click(carItem);

    await waitFor(() => {
      expect(screen.getAllByText(/Silver/i).length).toBeGreaterThan(0);
    });
  });

  it("asserts API error produces unavailable state without emptying the list", async () => {
    const user = userEvent.setup();
    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <VehicleInspector />
      </MockedProvider>
    );

    expect(await screen.findByText(/2023 Honda Accord/i)).toBeInTheDocument();

    const errorCarItem = screen.getByText(/2023 Honda Accord/i);
    await user.click(errorCarItem);

    await waitFor(() => {
      expect(screen.getByText(/Vehicle unavailable/i)).toBeInTheDocument();
      expect(screen.getByText(/Failed to fetch single vehicle/i)).toBeInTheDocument();
    });

    expect(screen.getAllByText(/2024 Toyota Camry/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2023 Honda Accord/i).length).toBeGreaterThan(0);
  });
});
