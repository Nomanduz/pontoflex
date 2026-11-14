import { act, fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Camera } from "./Camera";

describe("captura da câmera", () => {
  let stop: ReturnType<typeof vi.fn>;
  let drawImage: ReturnType<typeof vi.fn>;
  let canvas: HTMLCanvasElement | null;
  beforeEach(() => {
    stop = vi.fn();
    drawImage = vi.fn();
    canvas = null;
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] }) } });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
      canvas = this;
      return { drawImage } as unknown as CanvasRenderingContext2D;
    });
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/jpeg;base64,frame");
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("envia o mesmo recorte 3x4 central mostrado no vídeo, sem reduzir um quadro de 640px", async () => {
    const capture = vi.fn();
    const { container } = render(<Camera onCapture={capture} label="Capturar" />);
    await act(async () => {});
    const video = container.querySelector("video");
    if (!video) throw new Error("Câmera ausente");
    Object.defineProperties(video, { videoWidth: { value: 640 }, videoHeight: { value: 480 }, readyState: { value: 2 } });
    fireEvent.loadedData(video);
    fireEvent.click(screen.getByRole("button", { name: "Capturar" }));
    expect(drawImage).toHaveBeenCalledWith(video, 140, 0, 360, 480, 0, 0, 360, 480);
    expect(canvas?.width).toBe(360);
    expect(canvas?.height).toBe(480);
    expect(capture).toHaveBeenCalledWith("data:image/jpeg;base64,frame");
  });

  it("não oferece uma captura enquanto a câmera não tiver um quadro pronto", async () => {
    const capture = vi.fn();
    render(<Camera onCapture={capture} label="Capturar" />);
    await act(async () => {});
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button")).toBeDisabled();
    expect(capture).not.toHaveBeenCalled();
  });

  it("libera uma câmera que termina de abrir depois da saída da tela", async () => {
    let finish: ((stream: MediaStream) => void) | undefined;
    vi.mocked(navigator.mediaDevices.getUserMedia).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const { unmount } = render(<Camera onCapture={vi.fn()} label="Capturar" />);
    unmount();
    await act(async () => { finish?.({ getTracks: () => [{ stop }] } as unknown as MediaStream); });
    expect(stop).toHaveBeenCalledOnce();
  });
});