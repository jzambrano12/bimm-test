import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockedProvider } from "@apollo/client/testing";
import { describe, it, expect } from "vitest";
import { GET_CARS, ADD_CAR } from "@/graphql/queries";
import { InventoryDashboard } from "@/components/InventoryDashboard";

const mockCars = [
  {
    id: "1",
    make: "Chevrolet",
    model: "Corvette",
    year: 2021,
    color: "Red",
    mobile: "https://placehold.co/640x360",
    tablet: "https://placehold.co/1023x576",
    desktop: "https://placehold.co/1440x810",
  },
  {
    id: "2",
    make: "Toyota",
    model: "Camry",
    year: 2024,
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

const newCarAdded = {
  id: "3",
  make: "Honda",
  model: "Civic",
  year: 2023,
  color: "Blue",
  mobile: "https://placehold.co/640x360",
  tablet: "https://placehold.co/1023x576",
  desktop: "https://placehold.co/1440x810",
  __typename: "Car" as const,
};

const updatedCarsWithTypename = [...mockCarsWithTypename, newCarAdded];

const mocks = [
  {
    request: { query: GET_CARS },
    result: { data: { cars: mockCarsWithTypename } },
  },
  {
    request: { query: GET_CARS },
    result: { data: { cars: updatedCarsWithTypename } },
  },
  {
    request: {
      query: ADD_CAR,
      variables: {
        make: "Honda",
        model: "Civic",
        year: 2023,
        color: "Blue",
      },
    },
    result: {
      data: {
        addCar: newCarAdded,
      },
    },
  },
];

describe("InventoryDashboard component", () => {
  it("renders car list from the API", async () => {
    render(
      <MockedProvider mocks={mocks}>
        <InventoryDashboard />
      </MockedProvider>
    );

    expect(await screen.findByText("2021 Chevrolet Corvette")).toBeInTheDocument();
    expect(screen.getByText("2024 Toyota Camry")).toBeInTheDocument();
  });

  it("searches and shows no-match message if nothing matches", async () => {
    const user = userEvent.setup();
    render(
      <MockedProvider mocks={mocks}>
        <InventoryDashboard />
      </MockedProvider>
    );

    expect(await screen.findByText("2021 Chevrolet Corvette")).toBeInTheDocument();

    const searchInput = screen.getByLabelText(/^Search by Model$/i);
    await user.type(searchInput, "NonexistentModel");

    expect(screen.getByText(/No cars match your search\./i)).toBeInTheDocument();
    expect(screen.queryByText("2021 Chevrolet Corvette")).not.toBeInTheDocument();
  });

  it("sorts cars correctly", async () => {
    const user = userEvent.setup();
    render(
      <MockedProvider mocks={mocks}>
        <InventoryDashboard />
      </MockedProvider>
    );

    expect(await screen.findByText("2021 Chevrolet Corvette")).toBeInTheDocument();

    const sortSelect = screen.getByRole("combobox", { name: /^Sort By$/i });
    await user.click(sortSelect);

    const yearOption = await screen.findByRole("option", { name: /Year \(Newest\)/i });
    await user.click(yearOption);

    await waitFor(() => {
      const headings = screen.getAllByRole("heading", { level: 6 });
      const carHeadings = headings.filter((h) => h.textContent?.includes("Camry") || h.textContent?.includes("Corvette"));
      expect(carHeadings[0]).toHaveTextContent("2024 Toyota Camry");
    });
  });

  it("submits add-car form, triggers mutation, and updates the view", async () => {
    const user = userEvent.setup();
    render(
      <MockedProvider mocks={mocks}>
        <InventoryDashboard />
      </MockedProvider>
    );

    expect(await screen.findByText("2021 Chevrolet Corvette")).toBeInTheDocument();

    const makeInput = screen.getByLabelText(/^Make$/i);
    const modelInput = screen.getByLabelText(/^Model$/i);
    const yearInput = screen.getByLabelText(/^Year$/i);
    const colorInput = screen.getByLabelText(/^Colour$/i);

    await user.type(makeInput, "Honda");
    await user.type(modelInput, "Civic");
    await user.type(yearInput, "2023");
    await user.type(colorInput, "Blue");

    const submitButton = screen.getByRole("button", { name: /^Add Car$/i });
    await user.click(submitButton);

    expect(await screen.findByText("2023 Honda Civic")).toBeInTheDocument();
  });
});
