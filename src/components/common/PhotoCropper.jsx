import { useCallback, useState } from 'react';
import Cropper from 'react-easy-crop';
import { ZoomIn, RotateCw, Check } from 'lucide-react';
import Modal from '@/components/common/Modal';
import { cropToPortraitBlob } from '@/services/imageService';
import { PHOTO_RATIO_W, PHOTO_RATIO_H } from '@/constants';
import { Spinner } from '@/components/common/Spinner';

export default function PhotoCropper({ open, imageSrc, onClose, onSave }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [saving, setSaving] = useState(false);

  const onCropComplete = useCallback((_, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  async function handleSave() {
    if (!imageSrc || !croppedAreaPixels) return;
    setSaving(true);
    try {
      const blob = await cropToPortraitBlob(imageSrc, croppedAreaPixels, rotation, zoom);
      await onSave({ blob, crop, zoom, rotation });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Crop Photo (3:4 Portrait)"
      size="md"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={saving || !croppedAreaPixels}>
            {saving ? <Spinner /> : <Check size={16} />}
            {saving ? 'Saving…' : 'Save Crop'}
          </button>
        </>
      }
    >
      <div className="relative h-80 bg-ink-900 rounded-lg overflow-hidden">
        {imageSrc && (
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={PHOTO_RATIO_W / PHOTO_RATIO_H}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={onCropComplete}
          />
        )}
      </div>
      <div className="mt-4 space-y-4">
        <div>
          <label className="label flex items-center gap-2">
            <ZoomIn size={14} /> Zoom ({zoom.toFixed(1)}x)
          </label>
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-brand-600"
          />
        </div>
        <div>
          <label className="label flex items-center gap-2">
            <RotateCw size={14} /> Rotation ({rotation}°)
          </label>
          <input
            type="range"
            min={0}
            max={360}
            step={1}
            value={rotation}
            onChange={(e) => setRotation(Number(e.target.value))}
            className="w-full accent-brand-600"
          />
        </div>
      </div>
    </Modal>
  );
}
