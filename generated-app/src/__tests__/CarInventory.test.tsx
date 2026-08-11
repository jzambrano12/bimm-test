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
  __typename: "Car" as const,
};

const mocks = [
  {
    request: { query: GET_CARS },
    result: { data: { cars: mockCarsWithTypename } },
  },
  {
    request: { query: GET_CARS },
    result: { data: { cars: mockCarsWithTypename } },
  },
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
    result: { data: { addCar: newCar } },
  },
  {
    request: { query: GET_CARS },
    result: { data: { cars: [...mockCarsWithTypename, newCar] } },
  },
];

describe("CarInventory component", () => {
  it("renders car inventory list from API", async () => {
    render(
      <MockedProvider mocks={mocks}>
        <CarInventory />
      </MockedProvider>
    );

    expect(screen.getByRole("progressbar")).toBeInTheDocument();

    expect(await screen.findByText("Car Inventory")).toBeInTheDocument();
    expect(await screen.findByText(/Toyota Camry/i)).toBeInTheDocument();
    expect(screen.getByText(/Honda Civic/i)).toBeInTheDocument();
  });

  it("filters by model case-insensitively and shows empty message", async () => {
    const user = userEvent.setup();
    render(
      <MockedProvider mocks={mocks}>
        <CarInventory />
      </MockedProvider>
    );

    expect(await screen.findByText(/Toyota Camry/i)).toBeInTheDocument();

    const searchInput = screen.getByLabelText(/search by model/i);
    await user.type(searchInput, "civ");

    expect(screen.queryByText(/Toyota Camry/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Honda Civic/i)).toBeInTheDocument();

    await user.clear(searchInput);
    await user.type(searchInput, "nonexistent");

    expect(screen.getByText("No cars match your search.")).toBeInTheDocument();
  });

  it("sorts cars by year and make", async () => {
    const user = userEvent.setup();
    render(
      <MockedProvider mocks={mocks}>
        <CarInventory />
      </MockedProvider>
    );

    expect(await screen.findByText(/Toyota Camry/i)).toBeInTheDocument();

    const sortSelect = screen.getByLabelText(/sort by/i);
    await user.click(sortSelect);

    const makeAscOption = await screen.findByRole("option", {
      name: /make \(alphabetical\)/i,
    });
    await user.click(makeAscOption);

    await waitFor(() => {
      const headings = screen.getAllByRole("heading");
      const carHeadings = headings.filter((h) =>
        /Toyota Camry|Honda Civic/i.test(h.textContent || "")
      );
      expect(carHeadings[0]).toHaveTextContent(/Honda Civic/i);
      expect(carHeadings[1]).toHaveTextContent(/Toyota Camry/i);
    });
  });

  it("submits the add car form and updates the list", async () => {
    const user = userEvent.setup();
    render(
      <MockedProvider mocks={mocks}>
        <CarInventory />
      </MockedProvider>
    );

    expect(await screen.findByText(/Toyota Camry/i)).toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: "Make" }), "Ford");
    await user.type(screen.getByRole("textbox", { name: "Model" }), "Mustang");
    await user.type(screen.getByRole("spinbutton", { name: "Year" }), "2025");
    await user.type(screen.getByRole("textbox", { name: "Color" }), "Red");

    const submitButton = screen.getByRole("button", { name: /add car/i });
    await user.click(submitButton);

    expect(await screen.findByText(/Ford Mustang/i)).toBeInTheDocument();
    expect(screen.getByText(/Red/i)).toBeInTheDocument();
  });
});
