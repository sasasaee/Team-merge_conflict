from pathlib import Path
import spiceypy as spice

# Find the project root and kernel directory
PROJECT_ROOT = Path(__file__).resolve().parents[1]
KERNEL_DIR = PROJECT_ROOT / "kernels"

# List all five kernels
kernels = [
    KERNEL_DIR / "lsk" / "naif0012.tls",
    KERNEL_DIR / "spk" / "de440s.bsp",
    KERNEL_DIR / "pck" / "pck00011.tpc",
    KERNEL_DIR / "pck" / "moon_pa_de440_200625.bpc",
    KERNEL_DIR / "fk" / "moon_de440_250416.tf",
]

try:
    # Load the kernels
    for kernel in kernels:
        spice.furnsh(str(kernel))
        print(f"Loaded: {kernel.name}")

    # Test: calculate the Sun's position relative to the Moon
    date = "2026-11-07T00:00:00"
    et = spice.str2et(date)

    position, light_time = spice.spkpos(
        "SUN",
        et,
        "J2000",
        "NONE",
        "MOON"
    )

    print("\nSPICE test successful!")
    print(f"Date: {date}")
    print(f"Sun position relative to Moon (km): {position}")
    print(f"Light time (seconds): {light_time}")

except Exception as error:
    print("\nSPICE test failed:")
    print(error)

finally:
    spice.kclear()