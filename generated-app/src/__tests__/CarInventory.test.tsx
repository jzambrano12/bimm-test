import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockedProvider } from "@apollo/client/testing";
import { describe, it, expect } from "vitesth";
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
  },
];

const mockCarsWithTypename = mockCars.map((car) => ({
  ...car,
  __typename: "Car" as const,
}));

const newCar = {
  id: "3",
  make: "Ford",
  model: "Mustang",
  year: 2025,
  color: "Red",
  mobile: "https://placehold.co/640x360",
  tablet: "https://placehold.co/1023x576",
  desktop: "https://placehold.co/1440x810",
};

const newCarWithTypename = {
  ...newCar,
  __typename: "Car" as const,
};

const mocks = [
  {
    request: { query: GET_CARS },
    result: { data: { cars: mockCarsWithTypename } },
  },
  {
    request: {
      query: ADD_CAR,
      variables: {
        make: "Ford",
        model: "Mustang",
        year: 2025,
        color: "Red",
      },
    },
    result: { data: { addCar: newCarWithTypename } },
  },
  {
    request: { query: GET_CARS },
    result: {
      data: {
        cars: [...mockCarsWithTypename, newCarWithTypename],
      },
    },
  },
];

describe("CarInventory component", () => {
  it("renders car list from GraphQL", async () => {
    render(
      <MockedProvider mocks={mocks} addTypename={true}>
        <CarInventory />
      </MockedProvider>
    );

    expect(await screen.findByText("Toyota Camry")).toBeInTheDocument();
    expect(screen.getByText("Honda Civic")).toBeInTheDocument();
  });

  it("narrows the list when typing in search", async () => {
    const user = userEvent.setup();
    render(
      <MockedProvider mocks={mocks} addTypename={true}>
        <CarInventory />
      </MockedProvider>
    );

    expect(await screen.findByText("Toyota Camry")).toBeInTheDocument();
    expect(screen.getByText("Honda Civic")).toBeInTheDocument();

    const searchInput = screen.getByLabelText(/search model/i);
    await user.type(searchInput, "Civic");

    expect(screen.queryByText("Toyota Camry")).not.toBeInTheDocument();
    expect(screen.getByText("Honda Civic")).toBeInTheDocument();
  });

  it("reorders the list when changing sort options", async () => {
    const user = userEvent.setup();
    render(
      <MockedProvider mocks={mocks} addTypename={true}>
        <CarInventory />
      </MockedProvider>
    );

    expect(await screen.findByText("Toyota Camry")).toBeInTheDocument();

    const sortSelect = screen.getByLabelText(/sort by/i);
    await user.click(sortSelect);

    const yearOption = await screen.findByRole("option", { name: /year/i });
    await user.click(yearOption);

    await waitFor(() => {
      const carCards = screen.getAllByRole("heading", { level: 6 });
      expect(carCards[0]).toHaveTextContent("Honda Civic");
      expect(carCards[1]).toHaveTextContent("Toyota Camry");
    });
  });
});
