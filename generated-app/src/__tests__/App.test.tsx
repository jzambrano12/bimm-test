import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockedProvider } from "@apollo/client/testing";
import { describe, it, expect } from "vitest";
import { GET_CARS, ADD_CAR } from "../graphql/queries";
import App from "../App";

const mockCars = [
  {
    id: "1",
    make: "Tesla",
    model: "Model 3",
    year: 2023,
    color: "White",
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
];

const newCar = {
  id: "3",
  make: "Chevrolet",
  model: "Corvette",
  year: 2024,
  color: "Blue",
  mobile: "https://placehold.co/640x360",
  tablet: "https://placehold.co/1023x576",
  desktop: "https://placehold.co/1440x810",
};

const mocks = [
  {
    request: { query: GET_CARS },
    result: { data: { cars: mockCars } },
  },
  {
    request: {
      query: ADD_CAR,
      variables: {
        make: "Chevrolet",
        model: "Corvette",
        year: 2024,
        color: "Blue",
      },
    },
    result: { data: { addCar: newCar } },
  },
  {
    request: { query: GET_CARS },
    result: { data: { cars: [...mockCars, newCar] } },
  },
];

describe("App Integration Tests", () => {
  it("renders initial car list, searches, sorts, and adds a new car", async () => {
    const user = userEvent.setup();

    render(
      <MockedProvider mocks={mocks}>
        <App />
      </MockedProvider>
    );

    expect(await screen.findByText(/Tesla/i)).toBeInTheDocument();
    expect(screen.getByText(/Ford/i)).toBeInTheDocument();

    const searchInput = screen.getByRole("textbox", { name: /search/i });
    await user.type(searchInput, "Tesla");

    expect(screen.getByText(/Tesla/i)).toBeInTheDocument();
    expect(screen.queryByText(/Ford Mustang/i)).not.toBeInTheDocument();

    await user.clear(searchInput);
    expect(screen.getByText(/Ford/i)).toBeInTheDocument();

    const sortSelect = screen.getByRole("combobox", { name: /sort by/i });
    await user.click(sortSelect);
    const yearOption = await screen.findByRole("option", { name: /year/i });
    await user.click(yearOption);

    await user.type(screen.getByRole("textbox", { name: /^make$/i }), "Chevrolet");
    await user.type(screen.getByRole("textbox", { name: /^model$/i }), "Corvette");
    await user.type(screen.getByRole("spinbutton", { name: /^year$/i }), "2024");
    await user.type(screen.getByRole("textbox", { name: /^color$/i }), "Blue");

    const submitButton = screen.getByRole("button", { name: /add car/i });
    await user.click(submitButton);

    await waitFor(async () => {
      expect(await screen.findByText(/Chevrolet/i)).toBeInTheDocument();
    });
  });
});
