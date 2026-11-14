import { useEffect, useMemo, useState } from "react";

const defaultSettings = {
  // Milestone 1, level 0 is the new-scale equivalent of the old level 100
  // default. Intentionally defaulted for now since higher levels have no images yet.
  merchantingMilestone: 1,
  merchantingLevel: 0,
  // Milestone 0, level 0 is the new-scale equivalent of the old detective
  // level 0 default. City Shortcuts unlock by milestone only, starting at
  // milestone 5, so the level is stored for display and future gates.
  detectiveMilestone: 0,
  detectiveLevel: 0,
  battleOfFortuneholdCompleted: false,
  roundTrip: true,
};

const useSettings = () => {
  const [settings, setSettings] = useState(() => {
    const settingsJson = localStorage.getItem("settings");
    const storedSettings = settingsJson ? JSON.parse(settingsJson) : {};
    const settings = { ...defaultSettings, ...storedSettings };
    if (storedSettings.merchantingMilestone === undefined) {
      // Settings saved before milestones were introduced stored a single
      // merchanting level number, which is not comparable to the new
      // milestone/level pair, so fall back to the defaults for both.
      settings.merchantingMilestone = defaultSettings.merchantingMilestone;
      settings.merchantingLevel = defaultSettings.merchantingLevel;
    }
    if (storedSettings.detectiveMilestone === undefined) {
      // Same as above: a stored single detective level number is on the old
      // absolute scale and is not comparable to the milestone/level pair.
      settings.detectiveMilestone = defaultSettings.detectiveMilestone;
      settings.detectiveLevel = defaultSettings.detectiveLevel;
    }
    return settings;
  });

  useEffect(() => {
    localStorage.setItem("settings", JSON.stringify(settings));
  }, [settings]);

  const merchantingMilestone = useMemo(() => {
    return settings.merchantingMilestone;
  }, [settings]);

  const merchantingLevel = useMemo(() => {
    return settings.merchantingLevel;
  }, [settings]);

  const detectiveMilestone = useMemo(() => {
    return settings.detectiveMilestone;
  }, [settings]);

  const detectiveLevel = useMemo(() => {
    return settings.detectiveLevel;
  }, [settings]);

  const battleOfFortuneholdCompleted = useMemo(() => {
    return settings.battleOfFortuneholdCompleted;
  }, [settings]);

  const roundTrip = useMemo(() => {
    if (settings.roundTrip === undefined) {
      return true; // Default to true if not set (old settings)
    }

    return settings.roundTrip;
  }, [settings]);

  const setMerchantingMilestone = (merchantingMilestone) => {
    setSettings((settings) => ({
      ...settings,
      merchantingMilestone:
        merchantingMilestone === "" ? "" : Number(merchantingMilestone),
    }));
  };

  const setMerchantingLevel = (merchantingLevel) => {
    setSettings((settings) => ({
      ...settings,
      merchantingLevel: merchantingLevel === "" ? "" : Number(merchantingLevel),
    }));
  };

  const setDetectiveMilestone = (detectiveMilestone) => {
    setSettings((settings) => ({
      ...settings,
      detectiveMilestone:
        detectiveMilestone === "" ? "" : Number(detectiveMilestone),
    }));
  };

  const setDetectiveLevel = (detectiveLevel) => {
    setSettings((settings) => ({
      ...settings,
      detectiveLevel: detectiveLevel === "" ? "" : Number(detectiveLevel),
    }));
  };

  const setBattleOfFortuneholdCompleted = (battleOfFortuneholdCompleted) => {
    setSettings((settings) => ({
      ...settings,
      battleOfFortuneholdCompleted,
    }));
  };

  const setRoundTrip = (roundTrip) => {
    setSettings((settings) => ({
      ...settings,
      roundTrip,
    }));
  };

  return {
    merchantingMilestone,
    merchantingLevel,
    detectiveMilestone,
    detectiveLevel,
    battleOfFortuneholdCompleted,
    roundTrip,
    setMerchantingMilestone,
    setMerchantingLevel,
    setDetectiveMilestone,
    setDetectiveLevel,
    setBattleOfFortuneholdCompleted,
    setRoundTrip,
  };
};

export default useSettings;
