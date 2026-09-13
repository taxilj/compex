import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ImageWithFallback } from "./ImageWithFallback";

describe("ImageWithFallback", () => {
  it("renders the image when a src is provided", () => {
    render(
      <ImageWithFallback
        src="https://mm.digikey.com/example.jpg"
        alt="STM32F103C8T6"
        fallback={<span>no photo</span>}
      />
    );

    const img = screen.getByRole("img", { name: "STM32F103C8T6" });
    expect(img.tagName).toBe("IMG");
    expect(img).toHaveAttribute("src", "https://mm.digikey.com/example.jpg");
    expect(screen.queryByText("no photo")).not.toBeInTheDocument();
  });

  it("switches to the local fallback when the image fails to load", () => {
    render(
      <ImageWithFallback
        src="https://in.element14.com/broken.jpg"
        alt="STM32F103C8T6"
        fallback={<span>no photo</span>}
      />
    );

    const img = screen.getByRole("img", { name: "STM32F103C8T6" });
    fireEvent.error(img);

    expect(screen.getByText("no photo")).toBeInTheDocument();
    expect(document.querySelector("img")).not.toBeInTheDocument();
  });

  it("renders the fallback directly when there is no src at all", () => {
    render(<ImageWithFallback src={null} alt="LM324N" fallback={<span>no photo</span>} />);

    expect(screen.getByText("no photo")).toBeInTheDocument();
    expect(document.querySelector("img")).not.toBeInTheDocument();
  });

  it("does not retry the failed image (the <img> is unmounted, so onError can't loop)", () => {
    render(
      <ImageWithFallback
        src="https://in.element14.com/broken.jpg"
        alt="STM32F103C8T6"
        fallback={<span>no photo</span>}
      />
    );

    const img = screen.getByRole("img", { name: "STM32F103C8T6" });
    fireEvent.error(img);

    // Once failed, the <img> element is gone entirely — there is nothing left
    // to re-trigger onError, so a permanently-broken URL can only fail once.
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByText("no photo")).toBeInTheDocument();
  });

  it("gives a fresh attempt when the src prop changes to a new URL", () => {
    const { rerender } = render(
      <ImageWithFallback
        src="https://in.element14.com/broken.jpg"
        alt="STM32F103C8T6"
        fallback={<span>no photo</span>}
      />
    );
    fireEvent.error(screen.getByRole("img", { name: "STM32F103C8T6" }));
    expect(screen.getByText("no photo")).toBeInTheDocument();

    rerender(
      <ImageWithFallback
        src="https://mm.digikey.com/working.jpg"
        alt="LM324N"
        fallback={<span>no photo</span>}
      />
    );

    expect(screen.getByRole("img", { name: "LM324N" })).toHaveAttribute(
      "src",
      "https://mm.digikey.com/working.jpg"
    );
    expect(screen.queryByText("no photo")).not.toBeInTheDocument();
  });

  it("preserves alt text whether the image or the fallback is showing", () => {
    const { rerender } = render(
      <ImageWithFallback src="https://mm.digikey.com/example.jpg" alt="TLC555CP" fallback={<span>no photo</span>} />
    );
    expect(screen.getByRole("img", { name: "TLC555CP" })).toBeInTheDocument();

    rerender(<ImageWithFallback src={null} alt="TLC555CP" fallback={<span>no photo</span>} />);
    expect(screen.getByRole("img", { name: "TLC555CP" })).toBeInTheDocument();
  });
});
