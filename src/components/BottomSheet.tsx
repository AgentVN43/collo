"use client";

import { Drawer } from "vaul";

/**
 * Bottom sheet dựa trên vaul: mở ở ~55% màn hình, vuốt lên để mở rộng full,
 * vuốt xuống hoặc chạm nền để đóng. API giữ nguyên (open / onClose / children).
 */
export default function BottomSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Drawer.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      snapPoints={[0.55, 1]}
      fadeFromIndex={0}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Drawer.Content
          aria-describedby={undefined}
          className="fixed bottom-0 inset-x-0 z-50 flex h-full max-h-[97%] flex-col rounded-t-2xl bg-white outline-none"
        >
          <Drawer.Title className="sr-only">Bottom sheet</Drawer.Title>
          {/* Tay nắm kéo */}
          <div className="shrink-0 py-2.5">
            <div className="mx-auto h-1.5 w-10 rounded-full bg-gray-300" />
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <div className="mx-auto w-full max-w-md">{children}</div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
