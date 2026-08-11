import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockedProvider } from "@apollo/client/testing";
import { describe, it, expect, vi } from "vitest";
import { ADD_CAR } from "@/graphql/queries";
import { AddCarForm } from "@/components/AddCarForm";

const newCarResult = {
  id: "2",
  make: "Honda",
  model: "Civic",
  year: 2023,
  color: "Blue",
  mobile: "https://placehold.co/640x360",
  tablet: "https://placehold.co/1023x576",
  desktop: "https://placehold.co/1440x810",
  __typename: "Car" as const,
};

describe("AddCarForm", () => {
  it("validates empty fields and prevents submission", async () => {
    const onCarAdded = vi.fn();

    render(
      <MockedProvider mocks={[]}>
        <AddCarForm onCarAdded={onCarAdded} />
      </MockedProvider>
    );

    const form = screen.getByRole("button", { name: /add car/i }).closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);

    expect(onCarAdded).not.toHaveBeenCalled();
  });

  it("validates implausible years and prevents submission", async () => {
    const user = userEvent.setup();
    const onCarAdded = vi.fn();

    render(
      <MockedProvider mocks={[]}>
        <AddCarForm onCarAdded={onCarAdded} />
      </MockedProvider>
    );

    await user.type(screen.getByRole("textbox", { name: /make/i }), "Honda");
    await user.type(screen.getByRole("textbox", { name: /model/i }), "Civic");
    await user.type(screen.getByRole("spinbutton", { name: /year/i }), "1850");
    await user.type(screen.getByRole("textbox", { name: /colour/i }), "Blue");

    const form = screen.getByRole("button", { name: /add car/i }).closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);

    expect(onCarAdded).not.toHaveBeenCalled();
  });

  it("submits the form successfully with correct variables and triggers mutation", async () => {
    const user = userEvent.setup();
    const onCarAdded = vi.fn();

    const mocks = [
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
            addCar: newCarResult,
          },
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <AddCarForm onCarAdded={onCarAdded} />
      </MockedProvider>
    );

    await user.type(screen.getByRole("textbox", { name: /make/i }), "Honda");
    await user.type(screen.getByRole("textbox", { name: /model/i }), "Civic");
    await user.type(screen.getByRole("spinbutton", { name: /year/i }), "2023");
    await user.type(screen.getByRole("textbox", { name: /colour/i }), "Blue");

    const submitButton = screen.getByRole("button", { name: /add car/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(onCarAdded).toHaveBeenCalled();
    });
  });
});
