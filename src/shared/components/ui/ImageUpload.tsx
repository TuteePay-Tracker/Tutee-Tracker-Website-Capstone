import { useRef, useState } from 'react';
import { Upload, X, Camera, Loader2 } from 'lucide-react';
import { uploadToCloudinary, getOptimizedUrl } from '@/shared/utils/cloudinary';
import { toast } from 'sonner';

interface ImageUploadProps {
  currentUrl?: string | null;
  onUpload: (url: string) => void;
  folder?: string;
  shape?: 'circle' | 'square';
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  defaultAvatar?: React.ReactNode;
}

const SIZES = {
  sm: { container: 'w-16 h-16', icon: 16, text: 'text-[10px]' },
  md: { container: 'w-24 h-24', icon: 20, text: 'text-xs' },
  lg: { container: 'w-32 h-32', icon: 24, text: 'text-xs' },
};

export const ImageUpload = ({
  currentUrl,
  onUpload,
  folder = 'tuteepay',
  shape = 'circle',
  size = 'md',
  label = 'Upload Photo',
  defaultAvatar,
}: ImageUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayUrl = preview || (currentUrl ? getOptimizedUrl(currentUrl, 128, 128) : null);
  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-2xl';
  const s = SIZES[size];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate size (max 5 MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be smaller than 5 MB');
      return;
    }

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    setIsUploading(true);
    try {
      const url = await uploadToCloudinary(file, folder);
      onUpload(url);
      toast.success('Photo uploaded successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload photo');
      setPreview(null);
    } finally {
      setIsUploading(false);
      // Reset input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreview(null);
    onUpload('');
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative group">
        {/* Photo display / placeholder */}
        <div
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className={`
            ${s.container} ${shapeClass}
            overflow-hidden cursor-pointer
            flex items-center justify-center
            transition-all duration-200
            ${!displayUrl && !isUploading && defaultAvatar 
              ? '' 
              : 'bg-gray-100 border-2 border-dashed border-gray-300 group-hover:border-green-500 group-hover:bg-green-50'}
            ${isUploading ? 'cursor-not-allowed opacity-70' : ''}
          `}
        >
          {displayUrl ? (
            <img
              src={displayUrl}
              alt="Profile"
              className={`w-full h-full object-cover ${shapeClass}`}
            />
          ) : isUploading ? (
            <Loader2 size={s.icon} className="text-green-700 animate-spin" />
          ) : defaultAvatar ? (
            defaultAvatar
          ) : (
            <div className="flex flex-col items-center gap-1 text-gray-400 group-hover:text-green-600 transition-colors">
              <Camera size={s.icon} />
            </div>
          )}
        </div>

        {/* Overlay on hover when photo exists */}
        {displayUrl && !isUploading && (
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`
              absolute inset-0 ${shapeClass}
              bg-black/40 opacity-0 group-hover:opacity-100
              flex items-center justify-center
              cursor-pointer transition-opacity duration-200
            `}
          >
            <Upload size={s.icon} className="text-white" />
          </div>
        )}

        {/* Remove button */}
        {displayUrl && !isUploading && (
          <button
            onClick={handleRemove}
            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-md transition-colors"
            title="Remove photo"
          >
            <X size={10} />
          </button>
        )}

        {/* Upload progress overlay */}
        {isUploading && (
          <div className={`absolute inset-0 ${shapeClass} bg-white/70 flex items-center justify-center`}>
            <Loader2 size={s.icon} className="text-green-700 animate-spin" />
          </div>
        )}
      </div>

      {/* Label / click prompt */}
      <button
        type="button"
        onClick={() => !isUploading && fileInputRef.current?.click()}
        disabled={isUploading}
        className={`${s.text} text-green-700 font-semibold hover:underline disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
      >
        {isUploading ? 'Uploading...' : label}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
};
