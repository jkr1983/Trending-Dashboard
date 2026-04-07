import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import ErrorBoundary from "../../components/ErrorBoundary";

const ThrowingComponent = ({ shouldThrow }) => {
  if (shouldThrow) throw new Error("Test error message");
  return <div>Child content</div>;
};

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  console.error.mockRestore();
});

describe("ErrorBoundary", () => {
  test("renders children when there is no error", () => {
    render(
      <ErrorBoundary>
        <div>Normal content</div>
      </ErrorBoundary>
    );
    expect(screen.getByText("Normal content")).toBeInTheDocument();
  });

  test("renders fallback UI when a child throws", () => {
    render(
      <ErrorBoundary title="Section failed">
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Section failed")).toBeInTheDocument();
  });

  test("displays the error message in fallback", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText("Test error message")).toBeInTheDocument();
  });

  test("shows default title when none provided", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  test("Try Again button resets the error state", () => {
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Try Again"));
    rerender(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText("Child content")).toBeInTheDocument();
  });
});
