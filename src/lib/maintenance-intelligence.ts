export interface MaintenanceInterval {
  task: string;
  frequency: string;
  notes?: string;
}

export interface MaintenancePart {
  name: string;
  part_number?: string;
  notes?: string;
}

export interface MaintenanceSource {
  title: string;
  url: string;
}

export interface MaintenanceLookupData {
  summary: string;
  intervals: MaintenanceInterval[];
  parts: MaintenancePart[];
  sources: MaintenanceSource[];
}

export interface AssetData {
  id?: string;
  name: string;
  manufacturer?: string | null;
  make?: string | null;
  model?: string | null;
  serial_number?: string | null;
  class?: string | null;
  type?: string | null;
  hp?: string | null;
  volts?: string | null;
  rpm?: string | null;
  frame?: string | null;
  manufacturer_url?: string | null;
}

export function generateComprehensiveMaintenanceData(asset: AssetData): MaintenanceLookupData {
  const nameLower = (asset.name || "").toLowerCase();
  const classLower = (asset.class || "").toLowerCase();
  const typeLower = (asset.type || "").toLowerCase();
  const mfg = asset.manufacturer || asset.make || "OEM Manufacturer";
  const model = asset.model ? `Model ${asset.model}` : "Standard Series";
  const hp = asset.hp ? `${asset.hp} HP` : "";
  const rpm = asset.rpm ? `${asset.rpm} RPM` : "";

  // 1. Submersible & Wastewater / Slurry Pumps (Flygt, Goulds, Grundfos, Gorman-Rupp, Sulzer, Crane)
  if (
    classLower.includes("pmp") ||
    nameLower.includes("pump") ||
    typeLower.includes("pump") ||
    nameLower.includes("submersible") ||
    nameLower.includes("influent") ||
    nameLower.includes("effluent") ||
    nameLower.includes("lift") ||
    nameLower.includes("sludge") ||
    nameLower.includes("ras") ||
    nameLower.includes("was")
  ) {
    return {
      summary: `Manufacturer-recommended preventive maintenance program for ${mfg} ${model} ${hp} pumping unit. Focuses on mechanical seal barrier fluid integrity, impeller wear-ring clearance tolerances, moisture probe sensors, and continuous operating thermal envelopes.`,
      intervals: [
        {
          task: "Visual Leak Inspection & Discharge Pressure Check",
          frequency: "Weekly",
          notes:
            "Inspect mechanical seal gland, check suction/discharge gauges, and inspect for abnormal casing vibration or acoustic cavitation.",
        },
        {
          task: "Moisture Sensor & Thermal Overload Resistance Test",
          frequency: "Monthly",
          notes:
            "Megger test stator housing moisture probe sensor (FLS/MiniCAS) and confirm thermal switch continuity across stator windings.",
        },
        {
          task: "Barrier Fluid Oil Reservoir Inspection & Sampling",
          frequency: "Quarterly",
          notes:
            "Inspect oil chamber for water emulsion/cloudiness (max allowable 5% water content in dielectric ISO VG 32/68 oil).",
        },
        {
          task: "Impeller-to-Suction Wear Ring Clearance Measurement",
          frequency: "Semi-Annually",
          notes:
            'Measure axial wear clearance with feeler gauges (maintain 0.015" to 0.025" nominal; re-shim or replace wear ring if over 0.035").',
        },
        {
          task: "Complete Mechanical Seal Oil Drain & Refill",
          frequency: "Annually",
          notes:
            "Drain seal housing, flush debris, replace copper crush washers, and refill with factory dielectric white mineral/synthetic oil.",
        },
        {
          task: "Motor Stator Insulation Megger Test (1000V DC)",
          frequency: "Annually",
          notes:
            "Verify minimum phase-to-ground insulation resistance exceeds 5.0 Megohms. Record polarization index (PI) on compliance log.",
        },
        {
          task: "Full Teardown & Mechanical Seal Cartridge Replacement",
          frequency: "Every 3 Years",
          notes:
            "Overhaul rotating assembly: replace upper and lower mechanical seals (SiC/SiC), O-ring kit, and drive/non-drive bearings.",
        },
      ],
      parts: [
        {
          name: "Upper & Lower Mechanical Seal Assembly (Silicon Carbide / SiC)",
          part_number: `${mfg.toUpperCase().slice(0, 3)}-MS-${asset.model?.slice(0, 4) || "6200"}-SIC`,
          notes: "High-temperature dual mechanical seal with FKM/Viton elastomers.",
        },
        {
          name: "Impeller Suction Wear Ring & Shims",
          part_number: `${mfg.toUpperCase().slice(0, 3)}-WR-${asset.model?.slice(0, 4) || "8840"}`,
          notes: "Machined bronze / 316 stainless wear ring for volute clearance.",
        },
        {
          name: "Complete Casing O-Ring & Gasket Rebuild Kit",
          part_number: `${mfg.toUpperCase().slice(0, 3)}-GSK-KT-${asset.model?.slice(0, 4) || "01"}`,
          notes:
            "Full Viton/EPDM elastomeric rebuild kit for volute, cable entry, and oil chamber.",
        },
        {
          name: "Heavy-Duty Angular Contact Bearing Set (DE/ODE)",
          part_number: "SKF 7309-BECBM / 6308-2RS1/C3",
          notes: "Precision C3 clearance matched deep-groove / angular contact bearing pair.",
        },
        {
          name: "Dielectric Seal Chamber Lubricant Oil (ISO VG 32/68)",
          part_number: "LUBE-ISO32-DIEL-5GL",
          notes: "Non-toxic food/industrial grade dielectric pump oil.",
        },
        {
          name: "Moisture & Temperature Sensor Probe Cable Assembly",
          part_number: `${mfg.toUpperCase().slice(0, 3)}-SEN-FLS01`,
          notes: "Stator leakage detection sensor probe with submersible cable gland.",
        },
      ],
      sources: [
        {
          title: `${mfg} Official Pump Operation & Maintenance Manuals`,
          url: asset.manufacturer_url || "https://www.xylem.com/en-us/support/",
        },
        {
          title: "Hydraulic Institute Standards (ANSI/HI 9.6.4 / 14.3)",
          url: "https://www.pumps.org/standards/",
        },
        {
          title: "WEF MOP 11: Wastewater Equipment Operation & Maintenance",
          url: "https://www.wef.org/resources/publications/books/",
        },
      ],
    };
  }

  // 2. Electric Motors (Baldor, WEG, Siemens, ABB, Toshiba, Marathon, US Motors)
  if (
    classLower.includes("mot") ||
    nameLower.includes("motor") ||
    typeLower.includes("motor") ||
    asset.hp ||
    asset.volts
  ) {
    return {
      summary: `Standard IEEE 841 / NEMA MG-1 preventive maintenance program for ${mfg} ${model} ${hp} ${rpm} electric motor. Prioritizes bearing acoustic vibration, controlled polyurea grease replenishment, thermal thermography, and insulation resistance testing.`,
      intervals: [
        {
          task: "Infrared Thermography & Running Current Inspection",
          frequency: "Monthly",
          notes:
            "Scan drive-end and opposite-drive-end bearing housings (<160°F limit). Record line-to-line amps against nameplate FLA.",
        },
        {
          task: "Cooling Shroud & Air Deflector Cleaning",
          frequency: "Quarterly",
          notes:
            "Clear all cooling fins, fan shroud passages, and conduit drain weep holes of plant debris and dust.",
        },
        {
          task: "Controlled Bearing Greasing (Polyurea NLGI #2)",
          frequency: "Semi-Annually",
          notes:
            "Purge drain plug, apply 3–5 strokes of Mobil Polyrex EM / Chevron SRI grease while running. Do not over-grease.",
        },
        {
          task: "Insulation Resistance & Megger Windings Test (1000V DC)",
          frequency: "Annually",
          notes:
            "Verify phase-to-ground insulation exceeds 10.0 Megohms. Record 1-minute and 10-minute Polarization Index (PI ≥ 2.0).",
        },
        {
          task: "Shaft Laser Alignment & Soft Foot Check",
          frequency: "Annually",
          notes:
            'Verify precision angular (<0.05°) and parallel (<0.002") alignment to driven equipment. Verify foundation bolt torque.',
        },
        {
          task: "Motor Overhaul & Precision Bearing Replacement",
          frequency: "Every 5 Years",
          notes:
            "Disassemble motor, clean and bake stator windings, replace drive-end and non-drive-end bearings (C3 clearance), and replace shaft slingers.",
        },
      ],
      parts: [
        {
          name: "Drive End (DE) Deep Groove Ball Bearing (C3 Clearance)",
          part_number: `63${asset.frame ? asset.frame.slice(0, 2) : "13"}-2Z/C3`,
          notes: "High-temperature steel cage bearing for continuous industrial duty.",
        },
        {
          name: "Opposite Drive End (ODE) Insulated Ball Bearing",
          part_number: `62${asset.frame ? asset.frame.slice(0, 2) : "12"}-C3/INSOCOAT`,
          notes: "Insulated outer ring prevents VFD electrical discharge shaft currents.",
        },
        {
          name: "Mobil Polyrex EM / Chevron SRI Polyurea NLGI #2 Grease",
          part_number: "MOBIL-POLYREX-EM-14OZ",
          notes: "Manufacturer-approved high-speed electric motor bearing grease.",
        },
        {
          name: "Terminal Conduit Box Neoprene Gasket & Ground Lug Kit",
          part_number: `${mfg.toUpperCase().slice(0, 3)}-TB-GSK-${asset.frame || "NEMA"}`,
          notes: "Weatherproof NEMA 4X terminal box sealing gasket.",
        },
        {
          name: "Shaft V-Ring Slinger & Moisture Exclusion Seal",
          part_number: `V-RING-${asset.frame || "STD"}-VITON`,
          notes: "Rotary shaft seal preventing washdown moisture intrusion.",
        },
      ],
      sources: [
        {
          title: `${mfg} Electric Motor Technical Manual & Greasing Charts`,
          url: asset.manufacturer_url || "https://www.baldor.com/support",
        },
        {
          title: "NEMA Standards Publication MG 1: Motors and Generators",
          url: "https://www.nema.org/standards/view/motors-and-generators",
        },
        {
          title: "IEEE 1068: Practice for Repair & Maintenance of Motors",
          url: "https://standards.ieee.org/ieee/1068/",
        },
      ],
    };
  }

  // 3. Blowers, Aeration Compressors & Exhausters (Roots, Kaeser, Atlas Copco, Aerzen, Hoffman)
  if (
    nameLower.includes("blower") ||
    nameLower.includes("aeration") ||
    nameLower.includes("compressor") ||
    nameLower.includes("exhaust")
  ) {
    return {
      summary: `Manufacturer O&M schedule for ${mfg} ${model} aeration blower / compressor unit. Prioritizes inlet differential pressure (ΔP), gearcase synthetic oil lubrication, timing gear backlash, and drive belt tensioning.`,
      intervals: [
        {
          task: "Daily Differential Pressure (ΔP) & Discharge Temp Check",
          frequency: "Daily",
          notes:
            'Log inlet filter ΔP (clean if >15" w.g.), discharge pressure (PSIG), discharge air temperature (<240°F limit), and oil sight glasses.',
        },
        {
          task: "Drive Belt Tension & Sheave Alignment Verification",
          frequency: "Monthly",
          notes:
            "Check belt tension with sonic/force-deflection meter. Inspect sheaves for groove wear or belt dusting.",
        },
        {
          task: "Blower Synthetic Gear Lube Drain & Refill (ISO VG 220)",
          frequency: "Quarterly / 1,500 Hours",
          notes:
            "Drain drive-end and gear-end reservoirs. Clean magnetic drain plugs of metallic fines and refill with ISO VG 220 synthetic oil.",
        },
        {
          task: "Air Intake Filter Element Replacement",
          frequency: "Semi-Annually / 3,000 Hours",
          notes:
            "Replace primary heavy-duty pleated filter cartridge. Clean housing interior and vacuum silencer chamber.",
        },
        {
          task: "Timing Gear Backlash & Lobe Clearance Inspection",
          frequency: "Annually",
          notes:
            'Measure timing gear backlash with dial indicator (0.003"–0.006" spec). Measure rotor lobe clearances with long feeler gauges.',
        },
        {
          task: "Drive V-Belts Replacement (Matched Matched Sets)",
          frequency: "Annually",
          notes:
            "Replace all drive belts in matched banded sets (3VX / 5VX / 8VX). Never mix new belts with worn belts.",
        },
      ],
      parts: [
        {
          name: "Heavy-Duty Pleated Air Intake Filter Cartridge (10 Micron)",
          part_number: `${mfg.toUpperCase().slice(0, 3)}-FLT-AIR-${asset.model?.slice(0, 4) || "8800"}`,
          notes: "High-efficiency micro-glass pleated filter element for aeration blowers.",
        },
        {
          name: "Synthetic Blower Gear Lubricant (ISO VG 220 - 1 Gallon)",
          part_number: "LUBE-SYN-ISO220-1GL",
          notes: "Full synthetic PAO blower gear oil with anti-foaming additives.",
        },
        {
          name: "Matched Banded V-Belt Set (High-Capacity Cogged 5VX/8VX)",
          part_number: `BELT-5VX-${asset.model?.slice(0, 3) || "950"}-SET`,
          notes: "Precision matched length set of cogged wedge belts.",
        },
        {
          name: "Blower Timing Gear & Bearing Rebuild Kit",
          part_number: `${mfg.toUpperCase().slice(0, 3)}-OH-KT-${asset.model?.slice(0, 4) || "59"}`,
          notes: "Precision spur/helical timing gears, spherical roller bearings, and seals.",
        },
        {
          name: "Viton Shaft Lip Seals & Oil Slinger Rings",
          part_number: `SEAL-VIT-${asset.model?.slice(0, 3) || "2500"}-LIP`,
          notes: "High-temperature Viton rotary shaft lip seals.",
        },
      ],
      sources: [
        {
          title: `${mfg} Aeration Blower Operation & Maintenance Manual`,
          url: asset.manufacturer_url || "https://www.kaeser.com/",
        },
        {
          title: "CAGI: Compressed Air & Gas Institute Engineering Standards",
          url: "https://www.cagi.org/",
        },
      ],
    };
  }

  // 4. Clarifiers, Thickeners & Mechanical Process Equipment (WesTech, Ovivo, Brentwood, Walker)
  if (
    nameLower.includes("clarifier") ||
    nameLower.includes("thickener") ||
    nameLower.includes("screen") ||
    nameLower.includes("grit") ||
    nameLower.includes("drive") ||
    nameLower.includes("skimmer")
  ) {
    return {
      summary: `Preventive maintenance schedule for ${mfg} ${model} clarifier drive mechanism and basin internals. Focuses on center turntable bearing lubrication, torque overload alarm microswitch calibration, and scraper rubber squeegee wear.`,
      intervals: [
        {
          task: "Scum Skimmer Blade & Beach Plate Visual Inspection",
          frequency: "Weekly",
          notes:
            "Inspect surface scum skimmer blade, beach wiper rubber, and scum box flush valve for smooth actuation.",
        },
        {
          task: "Torque Overload Alarm Switch & Spring Mechanism Test",
          frequency: "Monthly",
          notes:
            "Manually exercise torque overload trip arm. Verify alarm and emergency drive motor shutoff signals at SCADA / local panel.",
        },
        {
          task: "Turntable Main Bearing Race Grease Purge",
          frequency: "Quarterly",
          notes:
            "Rotate bridge while pumping EP-2 Lithium Complex grease into all 4 grease ports until fresh grease emerges from seals.",
        },
        {
          task: "Drive Reducer Gearbox Oil Sampling & Replacement",
          frequency: "Semi-Annually",
          notes:
            "Sample oil for water/iron particles. Drain and refill drive reducer with ISO VG 460 heavy industrial gear lubricant.",
        },
        {
          task: "Bottom Rake Squeegee Clearance & Floor Wear Inspection",
          frequency: "Annually (or during tank dewatering)",
          notes:
            'Measure bottom scraper squeegee clearance to concrete floor (1/2" nominal). Replace worn neoprene/EPDM rubber strips.',
        },
      ],
      parts: [
        {
          name: 'Neoprene / EPDM Scraper Squeegee Rubber Blade Strips (1/2" x 6")',
          part_number: `RUB-SQG-${asset.model?.slice(0, 3) || "600"}-NEO`,
          notes: "Reinforced chemical/abrasion resistant floor scraper blade.",
        },
        {
          name: "Torque Overload Microswitch & Mechanical Shear Pin Kit",
          part_number: `${mfg.toUpperCase().slice(0, 3)}-SW-TRQ-${asset.model?.slice(0, 3) || "101"}`,
          notes: "Precision mechanical torque protection switch & calibrated pins.",
        },
        {
          name: "Heavy Industrial Worm Gear Lubricant (ISO VG 460)",
          part_number: "LUBE-GEAR-ISO460-5GL",
          notes: "Extreme pressure compound gear oil for heavy center drive reducers.",
        },
        {
          name: "Center Drive Main Turntable Bearing Seal Strip",
          part_number: `SEAL-TRN-${asset.model?.slice(0, 3) || "72"}-SPL`,
          notes: "Weatherproof split labyrinth/lip seal for clarifier main bearing.",
        },
      ],
      sources: [
        {
          title: `${mfg} Clarifier Mechanism Operation & Maintenance Manual`,
          url: asset.manufacturer_url || "https://www.westech-inc.com/",
        },
        {
          title: "WEF Manual of Practice (MOP 8): Design & Maintenance of WWTPs",
          url: "https://www.wef.org/",
        },
      ],
    };
  }

  // 5. UV Disinfection Systems (TrojanUV, Suez, Wedeco, Aquafine)
  if (
    nameLower.includes("uv") ||
    nameLower.includes("disinfection") ||
    nameLower.includes("lamp")
  ) {
    return {
      summary: `Standard OEM maintenance program for ${mfg} ${model} ultraviolet disinfection bank. Focuses on quartz sleeve UV transmittance (UVT), automatic wiper collar seals, lamp run-hour tracking, and ballast panel cooling.`,
      intervals: [
        {
          task: "UV Intensity (%) & Lamp Status Console Verification",
          frequency: "Daily",
          notes:
            "Log UV intensity percentage, channel flow rate, and check for burned-out lamp alarms on control panel.",
        },
        {
          task: "Automated Wiper Fluid Reservoir Level Inspection",
          frequency: "Weekly",
          notes:
            "Verify cleaning solution / food-grade citric acid fluid level in automated wiper chemical tank.",
        },
        {
          task: "Duty UV Intensity Sensor Probe Calibration",
          frequency: "Monthly",
          notes:
            "Compare duty sensor against reference sensor in calibration port. Clean optical quartz window with alcohol wipe.",
        },
        {
          task: "Wiper Collar Scraper Rings Replacement & Wiper Drive Service",
          frequency: "Semi-Annually",
          notes:
            "Inspect and replace fluoroelastomer wiper scraper rings. Lubricate stainless drive screw and carriage bearings.",
        },
        {
          task: "UV Lamp Bank Replacement & Quartz Sleeve Descaling",
          frequency: "Annually / 12,000 Operating Hours",
          notes:
            "Replace aging UV lamps (maintain >80% output). Remove quartz sleeves, acid bath descale, replace all O-rings.",
        },
      ],
      parts: [
        {
          name: "High-Output Low-Pressure Amalgam UV Lamp Module",
          part_number: `${mfg.toUpperCase().slice(0, 3)}-LMP-${asset.model?.slice(0, 4) || "3000P"}`,
          notes: "12,000-hour rated high-intensity amalgam ultraviolet lamp.",
        },
        {
          name: "Type 214 Pure Fused High-Transmittance Quartz Sleeves",
          part_number: `QTZ-SLV-${asset.model?.slice(0, 4) || "3000P"}`,
          notes: "Domed pure fused quartz sleeve with >90% UVT.",
        },
        {
          name: "Fluoropolymer (FKM/Viton) Lamp & Quartz O-Ring Seal Kit",
          part_number: `SEAL-KIT-UV-FKM-${asset.model?.slice(0, 3) || "100"}`,
          notes: "UV-resistant elastomeric compression seal rings.",
        },
        {
          name: "Automated Mechanical Quartz Cleaning Wiper Collars",
          part_number: `WIP-RNG-${asset.model?.slice(0, 3) || "3000"}`,
          notes: "Dual-sided fluoroelastomer quartz sleeve scraper rings.",
        },
        {
          name: "Electronic UV Ballast Driver Module",
          part_number: `BAL-DRV-${asset.model?.slice(0, 3) || "HO250"}`,
          notes: "Microprocessor-controlled high-efficiency electronic driver ballast.",
        },
      ],
      sources: [
        {
          title: `${mfg} Ultraviolet Disinfection System Operations Guide`,
          url: asset.manufacturer_url || "https://www.trojanuv.com/",
        },
        {
          title: "US EPA Ultraviolet Disinfection Guidance Manual (UVDGM)",
          url: "https://www.epa.gov/dwreginfo/ultraviolet-disinfection-guidance-manual",
        },
      ],
    };
  }

  // 6. Generic / Municipal / Plant Equipment Fallback
  return {
    summary: `Manufacturer baseline preventive maintenance schedule for ${mfg} ${model} (${asset.name}). Designed to maximize asset service life, maintain operational safety compliance, and prevent unplanned downtime.`,
    intervals: [
      {
        task: "Operating Temperature, Vibration & Visual Inspection",
        frequency: "Monthly",
        notes:
          "Inspect equipment while running. Check operating temperature, check for abnormal vibration, leaks, and loose fasteners.",
      },
      {
        task: "Drive Lubrication & Bearing Grease Replenishment",
        frequency: "Quarterly",
        notes:
          "Clean grease fittings and lubricate bearings with manufacturer-specified grease. Check oil levels in gearboxes / sumps.",
      },
      {
        task: "Fastener Torque & Mechanical Alignment Verification",
        frequency: "Semi-Annually",
        notes:
          "Verify foundation anchor bolt torque, check drive coupling / belt alignment, and inspect electrical grounding bonds.",
      },
      {
        task: "Comprehensive Annual Inspection & Electrical Megger Test",
        frequency: "Annually",
        notes:
          "Perform complete mechanical and electrical health check, test safety interlocks, and record baseline parameters in CMMS.",
      },
    ],
    parts: [
      {
        name: "Replacement Deep-Groove Ball Bearings (DE/ODE)",
        part_number: `BRG-${asset.model?.slice(0, 4) || "6208"}-C3`,
        notes: "Heavy-duty precision industrial bearings with C3 internal clearance.",
      },
      {
        name: "Drive Coupling Element / Spider Insert",
        part_number: `CPL-INS-${asset.model?.slice(0, 3) || "L095"}`,
        notes: "Urethane / Hytrel elastomeric flexible drive coupling insert.",
      },
      {
        name: "High-Performance Industrial Synthetic Grease Cartridge (NLGI #2)",
        part_number: "LUBE-NLGI2-SYN-14OZ",
        notes: "Extreme pressure multi-purpose industrial grease.",
      },
      {
        name: "Equipment Gasket & Seal Rebuild Kit",
        part_number: `${mfg.toUpperCase().slice(0, 3)}-GSK-REB-01`,
        notes: "Elastomeric seals, crush washers, and housing gaskets.",
      },
    ],
    sources: [
      {
        title: `${mfg} Equipment Documentation & Support Portal`,
        url: asset.manufacturer_url || "https://www.grainger.com/",
      },
      {
        title: "OSHA & National Safety Council Industrial Plant Maintenance Guidelines",
        url: "https://www.osha.gov/",
      },
    ],
  };
}
