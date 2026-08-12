import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CarList } from "@/components/CarList";
import type { Car } from "@/types";

const mockCars: Car[] = [
  {
    id: "1",
    make: "Mercedes-Benz",
    model: "E-Class Cabriolet",
    year: 2024,
    color: "Black",
    mobile: "",
    tablet: "",
    desktop: "",
  },
  {
    id: "2",
    make: "Toyota",
    model: "Camry",
    year: 2023,
    color: "Silver",
    mobile: "",
    tablet: "",
    desktop: "",
  },
  {
    id: "3",
    make: "Honda",
    model: "Civic",
    year: 2022,
    color: "Blue",
    mobile: "",
    tablet: "",
    desktop: "",
  },
];

describe("CarList component", () => {
  it("truncates combined make and model exceeding 22 characters with an ellipsis", () => {
    const onSelectCar = vi.fn();
    const onRefresh = vi.fn();

    render(
      <CarList
        cars={mockCars}
        selectedId="1"
        onSelectCar={onSelectCar}
        onRefresh={onRefresh}
      />
    );

    const listItems = screen.getAllByRole("button");
    const firstItem = listItems[0];
    expect(firstItem).toBeDefined();
    if (firstItem) {
      expect(firstItem.textContent).toContain("…");
    }

    expect(screen.getByText("2024 Mercedes-Benz E-Class Cabriolet")).toBeInTheDocument();
  });

  it("supports arrow key navigation and wrapping behavior", () => {
    const onSelectCar = vi.fn();
    const onRefresh = vi.fn();

    render(
      <CarList
        cars={mockCars}
        selectedId={null}
        onSelectCar={onSelectCar}
        onRefresh={onRefresh}
      />
    );

    const region = screen.getByRole("region", { name: /car browser/i });
    region.focus();

    fireEvent.keyDown(region, { key: "ArrowDown" });
    fireEvent.keyDown(region, { key: "ArrowDown" });
    fireEvent.keyDown(region, { key: "ArrowDown" });
    fireEvent.keyDown(region, { key: "ArrowUp" });
    fireEvent.keyDown(region, { key: "Enter" });

    expect(onSelectCar).toHaveBeenCalledWith("3");
    expect(onRefresh).toHaveBeenCalled();
  });
});
