import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockedProvider } from "@apollo/client/testing";
import { describe, it, expect } from "vitest";
import { GET_CARS, ADD_CAR } from "@/graphql/queries";
import { CarInventoryList } from "@/components/CarInventoryList";

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
    model: "Accord",
    year: 2024,
    color: "Blue",
    mobile: "https://placehold.co/640x360",
    tablet: "https://placehold.co/1023x576",
    desktop: "https://placehold.co/1440x810",
  },
];

const newCarInput = {
  make: "Ford",
  model: "Mustang",
  year: 2023,
  color: "Red",
};

const addedCar = {
  id: "3",
  ...newCarInput,
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
    request: { query: ADD_CAR, variables: newCarInput },
    result: { data: { addCar: addedCar } },
  },
  {
    request: { query: GET_CARS },
    result: {
      data: {
        cars: [...mockCars, addedCar],
      },
    },
  },
];

describe("CarInventoryList component", () => {
  it("renders items returned by the API", async () => {
    render(
      <MockedProvider mocks={mocks}>
        <CarInventoryList />
      </MockedProvider>
    );

    expect(await screen.findByText(/Camry/i)).toBeInTheDocument();
    expect(screen.getByText(/Accord/i)).toBeInTheDocument();
  });

  it("narrows the list when typing in the search bar", async () => {
    const user = userEvent.setup();
    render(
      <MockedProvider mocks={mocks}>
        <CarInventoryList />
      </MockedProvider>
    );

    expect(await screen.findByText(/Camry/i)).toBeInTheDocument();
    expect(screen.getByText(/Accord/i)).toBeInTheDocument();

    const searchInput = screen.getByRole("textbox", { name: /search by model/i });
    await user.type(searchInput, "Camry");

    expect(screen.getByText(/Camry/i)).toBeInTheDocument();
    expect(screen.queryByText(/Accord/i)).not.toBeInTheDocument();
  });

  it("reorders the list when changing sort options", async () => {
    const user = userEvent.setup();
    render(
      <MockedProvider mocks={mocks}>
        <CarInventoryList />
      </MockedProvider>
    );

    expect(await screen.findByText(/Camry/i)).toBeInTheDocument();

    const initialImages = screen.getAllByRole("img");
    expect(initialImages[0]).toHaveAccessibleName(/Honda Accord/i);
    expect(initialImages[1]).toHaveAccessibleName(/Toyota Camry/i);

    const sortYearButton = screen.getByRole("button", { name: /sort by year/i });
    await user.click(sortYearButton);

    const reorderedImages = screen.getAllByRole("img");
    expect(reorderedImages[0]).toHaveAccessibleName(/Honda Accord/i);
    expect(reorderedImages[1]).toHaveAccessibleName(/Toyota Camry/i);
  });

  it("triggers the addCar mutation upon form submission", async () => {
    const user = userEvent.setup();
    render(
      <MockedProvider mocks={mocks}>
        <CarInventoryList />
      </MockedProvider>
    );

    expect(await screen.findByText(/Camry/i)).toBeInTheDocument();

    const makeInput = screen.getByRole("textbox", { name: /^make$/i });
    const modelInput = screen.getByRole("textbox", { name: /^model$/i });
    const yearInput = screen.getByRole("spinbutton", { name: /year/i });
    const colorInput = screen.getByRole("textbox", { name: /colour/i });

    await user.type(makeInput, "Ford");
    await user.type(modelInput, "Mustang");
    await user.type(yearInput, "2023");
    await user.type(colorInput, "Red");

    const submitButton = screen.getByRole("button", { name: /^add car$/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Mustang/i)).toBeInTheDocument();
    });
  });
});
