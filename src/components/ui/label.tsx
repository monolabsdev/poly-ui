import * as React from "react";
import FormLabel from "@mui/material/FormLabel";
import { SxProps } from "@mui/material/styles";
import { Theme } from "@mui/material/styles";

const Label = React.forwardRef<
  HTMLLabelElement,
  Omit<React.ComponentPropsWithoutRef<"label">, 'color'> & { sx?: SxProps<Theme> }
>(({ className, children, sx, ...props }, ref) => (
  <FormLabel
    ref={ref}
    component="label"
    className={className}
    sx={{
      display: "flex",
      alignItems: "center",
      gap: 1,
      fontSize: "14px",
      fontWeight: 500,
      color: "text.primary",
      mb: 0.5,
      cursor: "pointer",
      "&.Mui-disabled": {
        opacity: 0.5,
        cursor: "not-allowed",
      },
      ...sx as any,
    }}
    {...props}
  >
    {children}
  </FormLabel>
));
Label.displayName = "Label";

export { Label };
