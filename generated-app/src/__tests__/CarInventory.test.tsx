import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockedProvider } from "@apollo/client/testing";
import { describe, it, expect } from "vitest";
import { GET_CARS, ADD_CAR } from "../graphql/queries";
import App from "../App";

const mockCars = [
  {
    id: "1",
    make: "Honda",
    model: "Civic",
    year: 2021,
    color: "Blue",
    mobile: "https://placehold.co/640x360",
    tablet: "https://placehold.co/1023x576",
    desktop: "https://placehold.co/1440x810",
  },
  {
    id: "2",
    make: "Toyota",
    model: "Camry",
    year: 2023,
    color: "Silver",
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
  year: 2024,
  color: "Red",
  mobile: "https://placehold.co/640x360",
  tablet: "https://placehold.co/1023x576",
  desktop: "https://placehold.co/1440x810",
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
        year: 2024,
        color: "Red",
      },
    },
    result: { data: { addCar: newCar } },
  },
  {
    request: { query: GET_CARS },
    result: { data: { cars: [...mockCarsWithTypename, newCar] } },
  },
];

describe("CarInventory Application", () => {
  it("renders the car list returned by the API", async () => {
    render(
      <MockedProvider mocks={mocks}>
        <App />
      </MockedProvider>
    );

    expect(await screen.findByText("2021 Honda Civic")).toBeInTheDocument();
    expect(screen.getByText("2023 Toyota Camry")).toBeInTheDocument();
  });

  it("narrows the car list when typing in search", async () => {
    const user = userEvent.setup();
    render(
      <MockedProvider mocks={mocks}>
        <App />
      </MockedProvider>
    );

    expect(await screen.findByText("2021 Honda Civic")).toBeInTheDocument();
    expect(screen.getByText("2023 Toyota Camry")).toBeInTheDocument();

    const searchInput = screen.getByRole("textbox", { name: /filter by model/i });
    await user.type(searchInput, "Civic");

    expect(screen.getByText("2021 Honda Civic")).toBeInTheDocument();
    expect(screen.queryByText("2023 Toyota Camry")).not.toBeInTheDocument();
  });

  it("reorders the car list when changing sort options", async () => {
    const user = userEvent.setup();
    render(
      <MockedProvider mocks={mocks}>
        <App />
      </MockedProvider>
    );

    expect(await screen.findByText("2021 Honda Civic")).toBeInTheDocument();

    const sortYearButton = screen.getByRole("button", { name: /sort by year/i });
    await user.click(sortYearButton);

    const carCards = screen.getAllByText(/\d{4} (Honda|Toyota)/);
    expect(carCards[0]).toHaveTextContent("2023 Toyota Camry");
    expect(carCards[1]).toHaveTextContent("2021 Honda Civic");
  });

  it("submits the add car form and updates the view with the new car", async () => {
    const user = userEvent.setup();
    render(
      <MockedProvider mocks={mocks}>
        <App />
      </MockedProvider>
    );

    expect(await screen.findByText("2021 Honda Civic")).toBeInTheDocument();

    const makeInput = screen.getByRole("textbox", { name: /^make$/i });
    const modelInput = screen.getByRole("textbox", { name: /^model$/i });
    const yearInput = screen.getByRole("spinbutton", { name: /year/i });
    const colorInput = screen.getByRole("textbox", { name: /color/i });
    const submitButton = screen.getByRole("button", { name: /add car/i });

    await user.type(makeInput, "Ford");
    await user.type(modelInput, "Mustang");
    await user.type(yearInput, "2024");
    await user.type(colorInput, "Red");

    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("2024 Ford Mustang")).toBeInTheDocument();
    });
  });
});
