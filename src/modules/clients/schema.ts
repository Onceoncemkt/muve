import { z } from "zod";

export const clientFormSchema = z.object({
  businessName: z.string().min(2, "Nombre comercial requerido"),
  legalName: z.string().optional(),
  contactName: z.string().optional(),
  email: z.string().email("Correo inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  planId: z.string().optional().or(z.literal("")),
  customServiceName: z.string().optional(),
  monthlyAmount: z.coerce.number().positive("Monto mensual debe ser mayor a 0"),
  paymentDay: z.coerce.number().int().min(1).max(31),
  status: z.enum(["active", "inactive"]),
  notes: z.string().optional(),
});

export type ClientFormInput = z.infer<typeof clientFormSchema>;
