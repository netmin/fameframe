// @ts-ignore
import { create } from 'zustand';

interface useProModalStore {
    isOpen: boolean;
    onOpen: () => void;
    onClose: () => void;
}
// @ts-ignore
export const useProModal = create<useProModalStore>((set: Function) => ({
    isOpen: false,
    onOpen: () => set({ isOpen: true }),
    onClose: () => set({ isOpen: false }),
}));