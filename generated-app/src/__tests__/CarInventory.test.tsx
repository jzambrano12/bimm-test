import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockedProvider } from "@apollo/client/testing";
import { describe, it, expect } from "vitest";
import { GET_CARS, ADD_CAR } from "@/graphql/queries";
import { CarListView } from "@/components/CarListView";
import type { Car } from "@/types";

const mockCars: Car[] = [
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
    make: "Ford",
    model: "Mustang",
    year: 2021,
    color: "Red",
    mobile: "https://placehold.co/640x360",
    tablet: "https://placehold.co/1023x576",
    desktop: "https://placehold.co/1440x810",
  },
  {
    id: "3",
    make: "Honda",
    model: "Civic",
    year: 2023,
    color: "Blue",
    mobile: "https://placehold.co/640x360",
    tablet: "https://placehold.co/1023x576",
    desktop: "https://placehold.co/1440x810",
  },
];

const mockCarsWithTypename = mockCars.map((car) => ({
  ...car,
  __typename: "Car" as const,
}));

const newCarInput = {
  make: "Tesla",
  model: "Model 3",
  year: 2025,
  color: "White",
};

const addedCarResult = {
  id: "4",
  ...newCarInput,
  mobile: "https://placehold.co/640x360",
  tablet: "https://placehold.co/1023x576",
  desktop: "https://placehold.co/1440x810",
  __typename: "Car" as const,
};

const updatedCarsWithTypename = [
  ...mockCarsWithTypename,
  addedCarResult,
];

const mocks = [
  {
    request: { query: GET_CARS },
    result: { data: { cars: mockCarsWithTypename } },
  },
  {
    request: { query: ADD_CAR, variables: newCarInput },
    result: { data: { addCar: addedCarResult } },
  },
  {
    request: { query: GET_CARS },
    result: { data: { cars: updatedCarsWithTypename } },
  },
];

describe("CarInventory integration", () => {
  it("renders car list returned by the API", async () => {
    render(
      <MockedProvider mocks={mocks} addTypename={true}>
        <CarListView />
      </MockedProvider>
    );

    expect(await screen.findByText(/Toyota Camry/i)).toBeInTheDocument();
    expect(screen.getByText(/Ford Mustang/i)).toBeInTheDocument();
    expect(screen.getByText(/Honda Civic/i)).toBeInTheDocument();
  });

  it("narrows the list when searching by model", async () => {
    const user = userEvent.setup();
    render(
      <MockedProvider mocks={mocks} addTypename={true}>
        <CarListView />
      </MockedProvider>
    );

    expect(await screen.findByText(/Toyota Camry/i)).toBeInTheDocument();

    const searchInput = screen.getByLabelText(/filter by model/i);
    await user.type(searchInput, "Mustang");

    expect(screen.queryByText(/Toyota Camry/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Ford Mustang/i)).toBeInTheDocument();
  });

  it("reorders the list when changing sort options", async () => {
    const user = userEvent.setup();
    render(
      <MockedProvider mocks={mocks} addTypename={true}>
        <CarListView />
      </MockedProvider>
    );

    expect(await screen.findByText(/Toyota Camry/i)).toBeInTheDocument();

    const sortSelect = screen.getByLabelText(/sort by/i);
    await user.click(sortSelect);

    const newestOption = await screen.findByRole("option", {
      name: /newest/i,
    });
    await user.click(newestOption);

    const items = screen.getAllByRole("heading", { level: 6 });
    expect(items[0]).toHaveTextContent(/2024 Toyota Camry/);
    expect(items[1]).toHaveTextContent(/2023 Honda Civic/);
    expect(items[2]).toHaveTextContent(/2021 Ford Mustang/);
  });

  it("triggers mutation on form submission and updates inventory", async () => {
    const user = userEvent.setup();
    render(
      <MockedProvider mocks={mocks} addTypename={true}>
        <CarListView />
      </MockedProvider>
    );

    expect(await screen.findByText(/Toyota Camry/i)).toBeInTheDocument();

    await user.type(screen.getAllByRole("textbox", { name: /make/i })[0], newCarInput.make);
    await user.type(screen.getAllByRole("textbox", { name: /model/i })[0], newCarInput.model);
    await user.type(
      screen.getByRole("spinbutton", { name: /year/i }),
      newCarInput.year.toString()
    );
    await user.type(screen.getByRole("textbox", { name: /color/i }), newCarInput.color);

    const submitButton = screen.getByRole("button", { name: /add car/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/2025 Tesla Model 3/i)).toBeInTheDocument();
    });
  });
});
