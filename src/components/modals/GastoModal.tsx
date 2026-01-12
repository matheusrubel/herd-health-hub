import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, CalendarIcon, Wheat, Syringe, Users, MoreHorizontal, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';

const tiposGasto = [
  { value: 'Aquisição', label: 'Aquisição', icon: ShoppingCart },
  { value: 'Alimentação', label: 'Alimentação', icon: Wheat },
  { value: 'Sanitário', label: 'Sanitário', icon: Syringe },
  { value: 'Mão de Obra', label: 'Mão de Obra', icon: Users },
  { value: 'Outros', label: 'Outros', icon: MoreHorizontal },
];

const gastoSchema = z.object({
  data: z.date({
    required_error: 'Data é obrigatória',
  }).refine((date) => date <= new Date(), {
    message: 'Data não pode ser futura',
  }),
  tipo: z.string().min(1, 'Selecione o tipo'),
  valor: z.string()
    .min(1, 'Valor é obrigatório')
    .refine((val) => {
      const num = parseFloat(val.replace(',', '.'));
      return !isNaN(num) && num > 0;
    }, 'Valor deve ser maior que zero'),
  descricao: z.string().min(1, 'Descrição é obrigatória').max(500, 'Máximo 500 caracteres'),
  aplicacao: z.enum(['todos', 'lote', 'animal'], {
    required_error: 'Selecione a aplicação',
  }),
  lote_id: z.string().optional(),
  animal_id: z.string().optional(),
}).refine((data) => {
  if (data.aplicacao === 'lote' && !data.lote_id) {
    return false;
  }
  return true;
}, {
  message: 'Selecione o lote',
  path: ['lote_id'],
}).refine((data) => {
  if (data.aplicacao === 'animal' && !data.animal_id) {
    return false;
  }
  return true;
}, {
  message: 'Selecione o animal',
  path: ['animal_id'],
});

type GastoFormData = z.infer<typeof gastoSchema>;

interface GastoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editData?: {
    id: string;
    data: string;
    tipo: string;
    valor: number;
    descricao: string;
    aplicacao: string;
    lote_id?: string;
    animal_id?: string;
  };
}

export function GastoModal({ open, onOpenChange, editData }: GastoModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [calendarOpen, setCalendarOpen] = useState(false);

  const form = useForm<GastoFormData>({
    resolver: zodResolver(gastoSchema),
    defaultValues: {
      data: new Date(),
      tipo: '',
      valor: '',
      descricao: '',
      aplicacao: 'todos',
      lote_id: '',
      animal_id: '',
    },
  });

  const aplicacao = form.watch('aplicacao');

  // Reset form when modal opens/closes
  useEffect(() => {
    if (open) {
      if (editData) {
        form.reset({
          data: new Date(editData.data + 'T12:00:00'),
          tipo: editData.tipo,
          valor: editData.valor.toString().replace('.', ','),
          descricao: editData.descricao,
          aplicacao: (editData.aplicacao as 'todos' | 'lote' | 'animal') || 'todos',
          lote_id: editData.lote_id || '',
          animal_id: editData.animal_id || '',
        });
      } else {
        form.reset({
          data: new Date(),
          tipo: '',
          valor: '',
          descricao: '',
          aplicacao: 'todos',
          lote_id: '',
          animal_id: '',
        });
      }
    }
  }, [open, editData, form]);

  // Fetch lotes ativos
  const { data: lotes } = useQuery({
    queryKey: ['lotes-ativos', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lotes')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data;
    },
    enabled: !!user && open,
  });

  // Fetch animais ativos
  const { data: animais } = useQuery({
    queryKey: ['animais-ativos', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('animais')
        .select('id, numero_brinco, lotes(nome)')
        .eq('ativo', true)
        .order('numero_brinco');
      if (error) throw error;
      return data;
    },
    enabled: !!user && open,
  });

  const mutation = useMutation({
    mutationFn: async (values: GastoFormData) => {
      if (!user) throw new Error('Usuário não autenticado');

      const gastoData = {
        user_id: user.id,
        data: format(values.data, 'yyyy-MM-dd'),
        tipo: values.tipo,
        valor: parseFloat(values.valor.replace(',', '.')),
        descricao: values.descricao.trim(),
        aplicacao: values.aplicacao,
        lote_id: values.aplicacao === 'lote' ? values.lote_id : null,
        animal_id: values.aplicacao === 'animal' ? values.animal_id : null,
      };

      if (editData) {
        const { error } = await supabase
          .from('gastos')
          .update(gastoData)
          .eq('id', editData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('gastos')
          .insert(gastoData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gastos'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['financeiro-stats'] });
      queryClient.invalidateQueries({ queryKey: ['gastos-por-tipo'] });
      toast.success(editData ? 'Gasto atualizado!' : 'Gasto registrado!');
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error('Erro ao salvar gasto:', error);
      toast.error('Erro ao salvar gasto', {
        description: error.message,
      });
    },
  });

  const onSubmit = (values: GastoFormData) => {
    mutation.mutate(values);
  };

  const formatCurrency = (value: string) => {
    // Remove tudo exceto números e vírgula
    let cleaned = value.replace(/[^\d,]/g, '');
    // Garante apenas uma vírgula
    const parts = cleaned.split(',');
    if (parts.length > 2) {
      cleaned = parts[0] + ',' + parts.slice(1).join('');
    }
    // Limita decimais a 2
    if (parts[1]?.length > 2) {
      cleaned = parts[0] + ',' + parts[1].slice(0, 2);
    }
    return cleaned;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editData ? 'Editar Gasto' : 'Novo Gasto'}</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Data */}
              <FormField
                control={form.control}
                name="data"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data *</FormLabel>
                    <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "dd/MM/yyyy", { locale: ptBR })
                            ) : (
                              <span>Selecione a data</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={(date) => {
                            field.onChange(date);
                            setCalendarOpen(false);
                          }}
                          disabled={(date) => date > new Date()}
                          initialFocus
                          locale={ptBR}
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Tipo */}
              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {tiposGasto.map((tipo) => (
                          <SelectItem key={tipo.value} value={tipo.value}>
                            <div className="flex items-center gap-2">
                              <tipo.icon className="h-4 w-4" />
                              {tipo.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Valor */}
            <FormField
              control={form.control}
              name="valor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor (R$) *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        R$
                      </span>
                      <Input
                        {...field}
                        placeholder="0,00"
                        className="pl-10"
                        onChange={(e) => {
                          field.onChange(formatCurrency(e.target.value));
                        }}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Descrição */}
            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição *</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Ex: Ração 10 toneladas, Vacina contra aftosa, etc."
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Aplicação */}
            <FormField
              control={form.control}
              name="aplicacao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Aplicar custo em *</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="grid grid-cols-1 gap-2 sm:grid-cols-3"
                    >
                      <div className="flex items-center space-x-2 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                        <RadioGroupItem value="todos" id="todos" />
                        <Label htmlFor="todos" className="cursor-pointer flex-1">
                          <div className="font-medium">Todos animais</div>
                          <div className="text-xs text-muted-foreground">Rateio igual</div>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                        <RadioGroupItem value="lote" id="lote" />
                        <Label htmlFor="lote" className="cursor-pointer flex-1">
                          <div className="font-medium">Lote específico</div>
                          <div className="text-xs text-muted-foreground">Rateio no lote</div>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                        <RadioGroupItem value="animal" id="animal" />
                        <Label htmlFor="animal" className="cursor-pointer flex-1">
                          <div className="font-medium">Animal individual</div>
                          <div className="text-xs text-muted-foreground">Valor integral</div>
                        </Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Lote Select */}
            {aplicacao === 'lote' && (
              <FormField
                control={form.control}
                name="lote_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lote *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o lote" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {lotes?.map((lote) => (
                          <SelectItem key={lote.id} value={lote.id}>
                            {lote.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Animal Select */}
            {aplicacao === 'animal' && (
              <FormField
                control={form.control}
                name="animal_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Animal *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o animal" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {animais?.map((animal) => (
                          <SelectItem key={animal.id} value={animal.id}>
                            #{animal.numero_brinco} - {(animal.lotes as any)?.nome || 'Sem lote'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
