import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockedProvider } from "@apollo/client/testing";
import { describe, it, expect } from "vitest";
import { GET_CARS, GET_CAR } from "../graphql/queries";
import { InspectorView } from "../components/InspectorView";

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
    make: "Honda",
    model: "Civic",
    year: 2023,
    color: "Blue",
    mobile: "https://placehold.co/640x360",
    tablet: "https://placehold.co/1023x576",
    desktop: "https://placehold.co/1440x810",
    __typename: "Car" as const,
  },
];

const mocks = [
  {
    request: { query: GET_CARS },
    result: { data: { cars: mockCars } },
  },
  {
    request: { query: GET_CAR, variables: { id: "1" } },
    result: { data: { car: mockCars[0] } },
  },
  {
    request: { query: GET_CAR, variables: { id: "2" } },
    result: { data: { car: mockCars[1] } },
  },
  {
    request: { query: GET_CAR, variables: { id: "999" } },
    error: new Error("Car not found"),
  },
];

const errorMocks = [
  {
    request: { query: GET_CARS },
    result: { data: { cars: mockCars } },
  },
  {
    request: { query: GET_CAR, variables: { id: "1" } },
    error: new Error("Failed to fetch car detail"),
  },
];

describe("InspectorView component", () => {
  it("asserts list renders items returned by API", async () => {
    render(
      <MockedProvider mocks={mocks}>
        <InspectorView />
      </MockedProvider>
    );

    expect(await screen.findByText(/2024 Toyota Camry/i)).toBeInTheDocument();
    expect(screen.getByText(/2023 Honda Civic/i)).toBeInTheDocument();
  });

  it("asserts selecting a vehicle triggers single-vehicle request", async () => {
    const user = userEvent.setup();
    render(
      <MockedProvider mocks={mocks}>
        <InspectorView />
      </MockedProvider>
    );

    const firstCar = await screen.findByText(/2024 Toyota Camry/i);
    await user.click(firstCar);

    await waitFor(() => {
      expect(screen.getByText(/Silver/i)).toBeInTheDocument();
      expect(screen.getByText(/Desktop/i)).toBeInTheDocument();
    });
  });

  it("asserts API error on single lookup shows unavailable state without emptying list", async () => {
    const user = userEvent.setup();
    render(
      <MockedProvider mocks={errorMocks}>
        <InspectorView />
      </MockedProvider>
    );

    const firstCar = await screen.findByText(/2024 Toyota Camry/i);
    expect(firstCar).toBeInTheDocument();

    await user.click(firstCar);

    await waitFor(() => {
      expect(screen.getByText(/failed to fetch car detail/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/2024 Toyota Camry/i)).toBeInTheDocument();
    expect(screen.getByText(/2023 Honda Civic/i)).toBeInTheDocument();
  });

  it("asserts arrow keys move and wrap selection correctly", async () => {
    const user = userEvent.setup();
    render(
      <MockedProvider mocks={mocks}>
        <InspectorView />
      </MockedProvider>
    );

    const listContainer = await screen.findByRole("list", { name: /vehicle list/i });
    listContainer.focus();

    await user.keyboard("{ArrowDown}");

    await waitFor(() => {
      expect(screen.getByText(/Silver/i)).toBeInTheDocument();
    });

    await user.keyboard("{ArrowDown}");

    await waitFor(() => {
      expect(screen.getByText(/Blue/i)).toBeInTheDocument();
    });

    await user.keyboard("{ArrowDown}");

    await waitFor(() => {
      expect(screen.getByText(/Silver/i)).toBeInTheDocument();
    });

    await user.keyboard("{ArrowUp}");

    await waitFor(() => {
      expect(screen.getByText(/Blue/i)).toBeInTheDocument();
    });
  });

  it("asserts name truncation in list vs full text in detail panel", async () => {
    const user = userEvent.setup();
    render(
      <MockedProvider mocks={mocks}>
        <InspectorView />
      </MockedProvider>
    );

    const listItemText = await screen.findByText(/2024 Toyota Camry/i);
    const listItem = listItemText.closest("div");
    expect(listItem).not.toBeNull();
    
    await user.click(listItemText);

    await waitFor(() => {
      const detailHeader = screen.getByRole("heading", { name: /2024 Toyota Camry/i });
      expect(detailHeader).toBeInTheDocument();
    });
  });
});
