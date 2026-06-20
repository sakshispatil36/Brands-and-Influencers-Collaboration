import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";

interface Props {
  onSave: (dataUrl: string) => void;
}

export default function SignaturePad({ onSave }: Props) {
  const sigCanvas = useRef<SignatureCanvas>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  const saveSignature = () => {
    // If user uploaded image, save that
    if (uploadedImage) {
      onSave(uploadedImage);
      return;
    }

    // Otherwise save drawn signature
    if (!sigCanvas.current) return;

    const image = sigCanvas.current?.getCanvas().toDataURL("image/png");

    onSave(image);
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      setUploadedImage(reader.result as string);
    };

    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-3">
      <SignatureCanvas
        ref={sigCanvas}
        penColor="black"
        canvasProps={{
          width: 500,
          height: 200,
          className: "border rounded bg-white",
        }}
      />

      <div className="mt-4">
        <label className="font-medium block mb-2">
          Upload Signature Image
        </label>

        <input
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
        />

        {uploadedImage && (
          <div className="mt-3">
            <p className="text-sm text-green-600">
              Signature image selected ✓
            </p>

            <img
              src={uploadedImage}
              alt="Uploaded Signature"
              className="mt-2 h-20 border rounded"
            />
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button onClick={saveSignature}>
          Save Signature
        </Button>

        <Button
          variant="outline"
          onClick={() => {
            sigCanvas.current?.clear();
            setUploadedImage(null);
          }}
        >
          Clear
        </Button>
      </div>
    </div>
  );
}