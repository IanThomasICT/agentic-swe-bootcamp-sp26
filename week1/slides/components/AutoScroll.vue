<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";

const props = defineProps<{
  sections: string[];
  delay?: number;
}>();

const wrapper = ref<HTMLElement>();
let observer: MutationObserver | null = null;
let step = 0;
let mounted = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const scrollDelay = props.delay ?? 600;

function scrollToMarker(marker: string) {
  const el = wrapper.value;
  if (!el) return;

  if (marker === "") {
    el.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  if (marker === "$bottom") {
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    return;
  }

  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    if (node.textContent?.includes(marker)) {
      const parent = node.parentElement;
      if (!parent) continue;
      const wrapperRect = el.getBoundingClientRect();
      const targetRect = parent.getBoundingClientRect();
      const relativeTop = targetRect.top - wrapperRect.top + el.scrollTop;
      const offset = wrapperRect.height * 0.15;
      el.scrollTo({
        top: Math.max(0, relativeTop - offset),
        behavior: "smooth",
      });
      return;
    }
  }
}

function pauseAndDelayAnimations(container: Element) {
  // Pause all Web Animations API animations inside the container,
  // then resume them after the scroll delay so scroll completes first.
  const animations = container.getAnimations({ subtree: true });
  if (animations.length === 0) return;

  for (const anim of animations) {
    anim.pause();
  }

  setTimeout(() => {
    for (const anim of animations) {
      anim.play();
    }
  }, scrollDelay);
}

function onMutation() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    // Skip mutations from initial render
    if (!mounted) {
      mounted = true;
      return;
    }

    const el = wrapper.value;
    if (!el) return;

    const container =
      el.querySelector(".shiki-magic-move-container") || el;

    // Pause animations so scroll can happen first
    pauseAndDelayAnimations(container);

    // Scroll to the current section
    if (step < props.sections.length) {
      scrollToMarker(props.sections[step]);
      step++;
    }
  }, 20);
}

onMounted(() => {
  if (!wrapper.value) return;

  const target =
    wrapper.value.querySelector(".shiki-magic-move-container") ||
    wrapper.value.querySelector(".slidev-code-magic-move") ||
    wrapper.value;

  observer = new MutationObserver(onMutation);
  observer.observe(target, {
    childList: true,
    subtree: true,
  });
});

onUnmounted(() => {
  observer?.disconnect();
  if (debounceTimer) clearTimeout(debounceTimer);
});
</script>

<template>
  <div ref="wrapper" class="auto-scroll-wrapper">
    <slot />
  </div>
</template>

<style scoped>
.auto-scroll-wrapper {
  max-height: 72vh;
  overflow-y: auto;
  scroll-behavior: smooth;
}

.auto-scroll-wrapper::-webkit-scrollbar {
  width: 4px;
}
.auto-scroll-wrapper::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 2px;
}
</style>
