import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockedProvider } from "@apollo/client/testing";
import { describe, it, expect } from "vitest";
import { GET_CARS, ADD_CAR } from "@/graphql/queries";
import { CarInventory } from "@/components/CarInventory";

const mockCars = [
  {
    id: "1",
    make: "Toyota",
    model: "Camry",
    year: 2022,
    color: "Silver",
    mobile: "https://placehold.co/640x360",
    tablet: "https://placehold.co/1023x576",
    desktop: "https://placehold.co/1440x810",
    __typename: "Car" as const,
  },
  {
    id: "2",
    make: "Honda",
    model: "Civic",
    year: 2024,
    color: "Blue",
    mobile: "https://placehold.co/640x360",
    tablet: "https://placehold.co/1023x576",
    desktop: "https://placehold.co/1440x810",
    __typename: "Car" as const,
  },
];

const updatedCars = [
  ...mockCars,
  {
    id: "3",
    make: "Ford",
    model: "Mustang",
    year: 2023,
    color: "Red",
    mobile: "https://placehold.co/640x360",
    tablet: "https://placehold.co/1023x576",
    desktop: "https://placehold.co/1440x810",
    __typename: "Car" as const,
  },
];

const baseMocks = [
  {
    request: { query: GET_CARS },
    result: { data: { cars: mockCars } },
  },
];

const addCarMocks = [
  {
    request: { query: GET_CARS },
    result: { data: { cars: mockCars } },
  },
  {
    request: {
      query: ADD_CAR,
      variables: {
        make: "Ford",
        model: "Mustang",
        year: 2023,
        color: "Red",
      },
    },
    result: {
      data: {
        addCar: {
          id: "3",
          make: "Ford",
          model: "Mustang",
          year: 2023,
          color: "Red",
          mobile: "https://placehold.co/640x360",
          tablet: "https://placehold.co/1023x576",
          desktop: "https://placehold.co/1440x810",
          __typename: "Car",
        },
      },
    },
  },
  {
    request: { query: GET_CARS },
    result: { data: { cars: updatedCars } },
  },
];

describe("CarInventory component", () => {
  it("renders car inventory list from GraphQL", async () => {
    render(
      <MockedProvider mocks={baseMocks} addTypename={true}>
        <CarInventory />
      </MockedProvider>
    );

    expect(await screen.findByText("Camry")).toBeInTheDocument();
    expect(screen.getByText("Civic")).toBeInTheDocument();
  });

  it("filters the car list by model case-insensitively", async () => {
    const user = userEvent.setup();

    render(
      <MockedProvider mocks={baseMocks} addTypename={true}>
        <CarInventory />
      </MockedProvider>
    );

    expect(await screen.findByText("Camry")).toBeInTheDocument();
    expect(screen.getByText("Civic")).toBeInTheDocument();

    const searchInput = screen.getByLabelText(/search model/i);
    await user.type(searchInput, "civ");

    expect(screen.queryByText("Camry")).not.toBeInTheDocument();
    expect(screen.getByText("Civic")).toBeInTheDocument();
  });

  it("sorts the car list by make and year", async () => {
    const user = userEvent.setup();

    render(
      <MockedProvider mocks={baseMocks} addTypename={true}>
        <CarInventory />
      </MockedProvider>
    );

    expect(await screen.findByText("Camry")).toBeInTheDocument();

    const sortSelect = screen.getByLabelText(/sort by/i);
    await user.click(sortSelect);
    
    const yearOption = await screen.findByRole("option", { name: /year/i });
    await user.click(yearOption);

    expect(screen.getByText("Civic")).toBeInTheDocument();
  });

  it("submits the form to add a new car", async () => {
    const user = userEvent.setup();

    render(
      <MockedProvider mocks={addCarMocks} addTypename={true}>
        <CarInventory />
      </MockedProvider>
    );

    expect(await screen.findByText("Camry")).toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: /make/i }), "Ford");
    await user.type(screen.getByRole("textbox", { name: /model/i }), "Mustang");
    await user.type(screen.getByRole("textbox", { name: /year/i }), "2023");
    await user.type(screen.getByRole("textbox", { name: /color/i }), "Red");

    const submitButton = screen.getByRole("button", { name: /add car/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Mustang")).toBeInTheDocument();
    });
  });
});
