import React, { useEffect, useRef } from "react";
import { input } from "../game/state/inputState.js";
import { WheelIcon } from "./Icons.jsx";

function vibrate(ms) {
  if (navigator.vibrate) navigator.vibrate(ms);
}

function Joystick() {
  const baseRef = useRef(null);
  const knobRef = useRef(null);
  const pointerId = useRef(null);

  useEffect(() => {
    const base = baseRef.current;
    const knob = knobRef.current;
    const radius = base.clientWidth / 2;

    const setSteer = (dx) => {
      const clamped = Math.max(-radius, Math.min(radius, dx));
      input.steer = clamped / radius;
      knob.style.transform = `translate(${clamped}px, 0)`;
    };
    const reset = () => {
      input.steer = 0;
      knob.style.transform = "translate(0px, 0px)";
    };
    const onDown = (e) => {
      pointerId.current = e.pointerId;
      base.setPointerCapture(e.pointerId);
      const rect = base.getBoundingClientRect();
      setSteer(e.clientX - (rect.left + radius));
      e.preventDefault();
    };
    const onMove = (e) => {
      if (e.pointerId !== pointerId.current) return;
      const rect = base.getBoundingClientRect();
      setSteer(e.clientX - (rect.left + radius));
    };
    const onUp = (e) => {
      if (e.pointerId !== pointerId.current) return;
      pointerId.current = null;
      reset();
    };
    base.addEventListener("pointerdown", onDown);
    base.addEventListener("pointermove", onMove);
    base.addEventListener("pointerup", onUp);
    base.addEventListener("pointercancel", onUp);
    return () => {
      base.removeEventListener("pointerdown", onDown);
      base.removeEventListener("pointermove", onMove);
      base.removeEventListener("pointerup", onUp);
      base.removeEventListener("pointercancel", onUp);
    };
  }, []);

  return (
    <div className="joystick" ref={baseRef}>
      <div className="wheel-icon">
        <WheelIcon />
      </div>
      <div className="knob" ref={knobRef} />
    </div>
  );
}

function Pedal({ className, label, prop, boolean }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    const press = (e) => {
      el.setPointerCapture(e.pointerId);
      el.classList.add("pressed");
      input[prop] = boolean ? true : 1;
      vibrate(14);
      e.preventDefault();
    };
    const release = () => {
      el.classList.remove("pressed");
      input[prop] = boolean ? false : 0;
    };
    el.addEventListener("pointerdown", press);
    el.addEventListener("pointerup", release);
    el.addEventListener("pointercancel", release);
    el.addEventListener("pointerleave", release);
    return () => {
      el.removeEventListener("pointerdown", press);
      el.removeEventListener("pointerup", release);
      el.removeEventListener("pointercancel", release);
      el.removeEventListener("pointerleave", release);
    };
  }, [prop, boolean]);
  return (
    <button ref={ref} className={`pedal ${className}`}>
      {label}
    </button>
  );
}

export default function TouchControls() {
  return (
    <div className="touch">
      <Joystick />
      <div className="pedals">
        <Pedal className="brake" label="BRAKE" prop="brake" />
        <Pedal className="gas" label="GAS" prop="throttle" />
        <Pedal className="small" label="REV" prop="reverse" />
        <Pedal className="small" label="HAND" prop="handbrake" boolean />
      </div>
    </div>
  );
}
