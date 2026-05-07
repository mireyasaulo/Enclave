import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  buyFarmSeed,
  debugFarmPlot,
  getFarmEvents,
  getFarmNeighborDetail,
  getFarmNeighbors,
  getFarmState,
  harvestFarmPlot,
  plantFarmCrop,
  sellFarmCrop,
  waterFarmPlot,
  weedFarmPlot,
  type FarmCropId,
  type FarmEventView,
  type FarmHarvestResult,
  type FarmNeighborDetail,
  type FarmNeighborSummary,
  type FarmPlayerStateView,
} from "@yinjie/contracts";

const STATE_KEY = ["farm", "state"] as const;
const NEIGHBORS_KEY = ["farm", "neighbors"] as const;
const EVENTS_KEY = ["farm", "events"] as const;

export function useFarmState() {
  return useQuery<FarmPlayerStateView>({
    queryKey: STATE_KEY,
    queryFn: () => getFarmState(),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useFarmNeighbors(options?: { limit?: number }) {
  return useQuery<FarmNeighborSummary[]>({
    queryKey: [...NEIGHBORS_KEY, options?.limit ?? null],
    queryFn: () => getFarmNeighbors(options),
    staleTime: 60_000,
  });
}

export function useFarmNeighborDetail(characterId: string | null | undefined) {
  return useQuery<FarmNeighborDetail>({
    queryKey: ["farm", "neighbor", characterId],
    queryFn: () => getFarmNeighborDetail(characterId as string),
    enabled: Boolean(characterId),
    staleTime: 30_000,
  });
}

export function useFarmEvents(options?: { since?: string; limit?: number }) {
  return useQuery<FarmEventView[]>({
    queryKey: [...EVENTS_KEY, options?.since ?? null, options?.limit ?? null],
    queryFn: () => getFarmEvents(options),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}

function useInvalidateFarm() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["farm"] });
}

export function usePlantFarmCrop() {
  const invalidate = useInvalidateFarm();
  return useMutation({
    mutationFn: (input: { plotIndex: number; cropId: FarmCropId }) =>
      plantFarmCrop(input),
    onSuccess: () => invalidate(),
  });
}

export function useWaterFarmPlot() {
  const invalidate = useInvalidateFarm();
  return useMutation({
    mutationFn: (input: { plotIndex: number; characterId?: string }) =>
      waterFarmPlot(input),
    onSuccess: () => invalidate(),
  });
}

export function useWeedFarmPlot() {
  const invalidate = useInvalidateFarm();
  return useMutation({
    mutationFn: (input: { plotIndex: number; characterId?: string }) =>
      weedFarmPlot(input),
    onSuccess: () => invalidate(),
  });
}

export function useDebugFarmPlot() {
  const invalidate = useInvalidateFarm();
  return useMutation({
    mutationFn: (input: { plotIndex: number; characterId?: string }) =>
      debugFarmPlot(input),
    onSuccess: () => invalidate(),
  });
}

export function useHarvestFarmPlot() {
  const invalidate = useInvalidateFarm();
  return useMutation<FarmHarvestResult, Error, { plotIndex: number }>({
    mutationFn: (input) => harvestFarmPlot(input),
    onSuccess: () => invalidate(),
  });
}

export function useBuyFarmSeed() {
  const invalidate = useInvalidateFarm();
  return useMutation({
    mutationFn: (input: { cropId: FarmCropId; quantity: number }) =>
      buyFarmSeed(input),
    onSuccess: () => invalidate(),
  });
}

export function useSellFarmCrop() {
  const invalidate = useInvalidateFarm();
  return useMutation({
    mutationFn: (input: { cropId: FarmCropId; quantity: number }) =>
      sellFarmCrop(input),
    onSuccess: () => invalidate(),
  });
}
