import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockedProvider } from "@apollo/client/testing";
import { describe, it, expect } from "vitest";
import { GET_CARS, ADD_CAR } from "../graphql/queries";
import App from "../App";

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
    __typename: "Car" as const,
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
    __typename: "Car" as const,
  },
];

const newCar = {
  id: "3",
  make: "Tesla",
  model: "Model 3",
  year: 2023,
  color: "White",
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
        make: "Tesla",
        model: "Model 3",
        year: 2023,
        color: "White",
      },
    },
    result: { data: { addCar: newCar } },
  },
];

describe("App component", () => {
  it("renders car inventory list from API", async () => {
    render(
      <MockedProvider mocks={mocks} addTypename={true}>
        <App />
      </MockedProvider>
    );

    expect(await screen.findByText("2024 Toyota Camry")).toBeInTheDocument();
    expect(screen.getByText("2021 Ford Mustang")).toBeInTheDocument();
  });

  it("narrows the list when searching", async () => {
    const user = userEvent.setup();
    render(
      <MockedProvider mocks={mocks} addTypename={true}>
        <App />
      </MockedProvider>
    );

    expect(await screen.findByText("2024 Toyota Camry")).toBeInTheDocument();
    expect(screen.getByText("2021 Ford Mustang")).toBeInTheDocument();

    const searchInput = screen.getByLabelText(/search/i);
    await user.type(searchInput, "Toyota");

    expect(screen.getByText("2024 Toyota Camry")).toBeInTheDocument();
    expect(screen.queryByText("2021 Ford Mustang")).not.toBeInTheDocument();
  });

  it("reorders the list when sorting", async () => {
    const user = userEvent.setup();
    render(
      <MockedProvider mocks={mocks} addTypename={true}>
        <App />
      </MockedProvider>
    );

    expect(await screen.findByText("2024 Toyota Camry")).toBeInTheDocument();

    const sortSelect = screen.getByLabelText(/sort by/i);
    await user.click(sortSelect);

    const yearOption = await screen.findByRole("option", { name: /year/i });
    await user.click(yearOption);

    const cards = screen.getAllByRole("heading", { level: 6 });
    expect(cards[0]).toHaveTextContent("2021 Ford Mustang");
    expect(cards[1]).toHaveTextContent("2024 Toyota Camry");
  });

  it("sends mutation when submitting add car form", async () => {
    const user = userEvent.setup();
    render(
      <MockedProvider mocks={mocks} addTypename={true}>
        <App />
      </MockedProvider>
    );

    expect(await screen.findByText("2024 Toyota Camry")).toBeInTheDocument();

    const addButton = screen.getByRole("button", { name: /add car/i });
    await user.click(addButton);

    const makeInput = screen.getByLabelText(/make/i);
    const modelInput = screen.getByLabelText(/model/i);
    const yearInput = screen.getByLabelText(/year/i);
    const colorInput = screen.getByLabelText(/color/i);

    await user.type(makeInput, "Tesla");
    await user.type(modelInput, "Model 3");
    await user.type(yearInput, "2023");
    await user.type(colorInput, "White");

    const submitButton = screen.getByRole("button", { name: /^add car$/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("2023 Tesla Model 3")).toBeInTheDocument();
    });
  });
});
