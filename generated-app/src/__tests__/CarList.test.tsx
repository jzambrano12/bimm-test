import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockedProvider } from "@apollo/client/testing";
import { describe, it, expect } from "vitest";
import { GET_CARS, ADD_CAR } from "../graphql/queries";
import { CarList } from "@/components/CarList";

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

const newCarResponse = {
  id: "3",
  make: "Ford",
  model: "Mustang",
  year: 2023,
  color: "Red",
  mobile: "https://placehold.co/640x360",
  tablet: "https://placehold.co/1023x576",
  desktop: "https://placehold.co/1440x810",
  __typename: "Car" as const,
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
        make: "Ford",
        model: "Mustang",
        year: 2023,
        color: "Red",
      },
    },
    result: { data: { addCar: newCarResponse } },
  },
  {
    request: { query: GET_CARS },
    result: { data: { cars: [...mockCars, newCarResponse] } },
  },
];

describe("CarList component", () => {
  it("renders car inventory data from the API", async () => {
    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <CarList />
      </MockedProvider>
    );

    expect(await screen.findByText(/Car Inventory/i)).toBeInTheDocument();
    expect(await screen.findByText(/Camry/i)).toBeInTheDocument();
    expect(screen.getByText(/Civic/i)).toBeInTheDocument();
  });

  it("allows searching for cars by model", async () => {
    const user = userEvent.setup();
    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <CarList />
      </MockedProvider>
    );

    expect(await screen.findByText(/Camry/i)).toBeInTheDocument();
    expect(screen.getByText(/Civic/i)).toBeInTheDocument();

    const searchInput = screen.getByRole("textbox", { name: /search/i });
    await user.type(searchInput, "Civic");

    expect(screen.queryByText(/Camry/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Civic/i)).toBeInTheDocument();
  });

  it("allows sorting cars by year and make", async () => {
    const user = userEvent.setup();
    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <CarList />
      </MockedProvider>
    );

    expect(await screen.findByText(/Camry/i)).toBeInTheDocument();

    const sortSelect = screen.getByLabelText(/sort by/i);
    await user.click(sortSelect);

    const newestOption = await screen.findByRole("option", {
      name: /year \(newest first\)/i,
    });
    await user.click(newestOption);

    const carHeadings = screen.getAllByRole("heading", { level: 6 });
    expect(carHeadings[1]?.textContent).toContain("Civic");
  });

  it("submits the form to add a new car and refetches the list", async () => {
    const user = userEvent.setup();
    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <CarList />
      </MockedProvider>
    );

    expect(await screen.findByText(/Camry/i)).toBeInTheDocument();

    await user.type(screen.getAllByRole("textbox", { name: /make/i })[0]!, "Ford");
    await user.type(screen.getAllByRole("textbox", { name: /model/i })[0]!, "Mustang");
    await user.type(screen.getByRole("spinbutton", { name: /year/i }), "2023");
    await user.type(screen.getAllByRole("textbox", { name: /color/i })[0]!, "Red");

    const submitButton = screen.getByRole("button", {
      name: /add car/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Mustang/i)).toBeInTheDocument();
    });
  });
});
