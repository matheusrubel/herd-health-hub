import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NumericInput } from '@/components/ui/numeric-input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { toast } from 'sonner';
import { Loader2, Search, AlertTriangle, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PesagemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  animalId?: string;
}

export function PesagemModal({ open, onOpenChange, animalId }: PesagemModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedAnimalId, setSelectedAnimalId] = useState(animalId || '');
  const [peso, setPeso] = useState('');
  // Usa formato ISO local para evitar problemas de timezone
  const getLocalDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const [data, setData] = useState(getLocalDateString());
  const [responsavelId, setResponsavelId] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [showWarning, setShowWarning] = useState<string | null>(null);

  useEffect(() => {
    if (animalId) {
      setSelectedAnimalId(animalId);
    }
  }, [animalId]);

  // Fetch animais
  const { data: animais } = useQuery({
    queryKey: ['animais-simples', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('animais')
        .select('id, numero_brinco, lote_id, lotes(nome)')
        .order('numero_brinco');
      if (error) throw error;
      return data;
    },
    enabled: !!user && open,
  });

  // Fetch responsáveis
  const { data: responsaveis } = useQuery({
    queryKey: ['responsaveis', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('responsaveis')
        .select('id, nome')
        .eq('status', 'Ativo')
        .order('nome');
      if (error) throw error;
      return data;
    },
    enabled: !!user && open,
  });

  // Fetch última pesagem do animal selecionado
  const { data: ultimaPesagem } = useQuery({
    queryKey: ['ultima-pesagem', selectedAnimalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pesagens')
        .select('peso, data')
        .eq('animal_id', selectedAnimalId)
        .order('data', { ascending: false })
        .limit(1)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!selectedAnimalId && open,
  });

  const selectedAnimal = animais?.find(a => a.id === selectedAnimalId);

  // Validar peso discrepante
  useEffect(() => {
    if (peso && ultimaPesagem) {
      const novoPeso = parseFloat(peso);
      const ultimoPeso = Number(ultimaPesagem.peso);
      const diasDesdeUltima = Math.max(1, Math.floor((new Date().getTime() - new Date(ultimaPesagem.data).getTime()) / (1000 * 60 * 60 * 24)));
      const diff = novoPeso - ultimoPeso;
      const gmd = diff / diasDesdeUltima;

      if (gmd < -1) {
        setShowWarning(`Peso abaixo da última pesagem (${ultimoPeso}kg). Confirma?`);
      } else if (gmd > 3) {
        setShowWarning(`Ganho muito alto (${diff.toFixed(1)}kg em ${diasDesdeUltima} dias). Confirma?`);
      } else {
        setShowWarning(null);
      }
    } else {
      setShowWarning(null);
    }
  }, [peso, ultimaPesagem]);

  const createPesagemMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('pesagens')
        .insert({
          user_id: user.id,
          animal_id: selectedAnimalId,
          data,
          peso: parseFloat(peso),
          responsavel_id: responsavelId || null,
          observacoes: observacoes || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pesagens'] });
      queryClient.invalidateQueries({ queryKey: ['animais'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Pesagem registrada!');
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error('Erro ao registrar pesagem', {
        description: error.message,
      });
    },
  });

  const resetForm = () => {
    setSelectedAnimalId(animalId || '');
    setPeso('');
    setData(getLocalDateString());
    setResponsavelId('');
    setObservacoes('');
    setShowWarning(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAnimalId) {
      toast.error('Selecione um animal');
      return;
    }
    if (!peso || parseFloat(peso) <= 0) {
      toast.error('Informe um peso válido');
      return;
    }
    createPesagemMutation.mutate();
  };

  const calcularGMD = () => {
    if (peso && ultimaPesagem) {
      const novoPeso = parseFloat(peso);
      const ultimoPeso = Number(ultimaPesagem.peso);
      const diasDesdeUltima = Math.max(1, Math.floor((new Date().getTime() - new Date(ultimaPesagem.data).getTime()) / (1000 * 60 * 60 * 24)));
      const gmd = (novoPeso - ultimoPeso) / diasDesdeUltima;
      return gmd.toFixed(2);
    }
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Pesagem</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Seleção de Animal com Autocomplete */}
          <div className="space-y-2">
            <Label>Animal *</Label>
            <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={comboboxOpen}
                  className="w-full justify-between"
                  disabled={!!animalId}
                >
                  {selectedAnimal
                    ? `#${selectedAnimal.numero_brinco}`
                    : "Buscar animal..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar por brinco..." />
                  <CommandList>
                    <CommandEmpty>Nenhum animal encontrado</CommandEmpty>
                    <CommandGroup>
                      {animais?.map((animal) => (
                        <CommandItem
                          key={animal.id}
                          value={animal.numero_brinco}
                          onSelect={() => {
                            setSelectedAnimalId(animal.id);
                            setComboboxOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedAnimalId === animal.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          #{animal.numero_brinco}
                          <span className="ml-2 text-muted-foreground">
                            {(animal.lotes as any)?.nome || 'Sem lote'}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Preview do animal selecionado */}
          {selectedAnimal && ultimaPesagem && (
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p><strong>Animal:</strong> #{selectedAnimal.numero_brinco}</p>
              <p><strong>Lote:</strong> {(selectedAnimal.lotes as any)?.nome || 'Sem lote'}</p>
              <p><strong>Última pesagem:</strong> {Number(ultimaPesagem.peso)}kg ({Math.floor((new Date().getTime() - new Date(ultimaPesagem.data).getTime()) / (1000 * 60 * 60 * 24))} dias atrás)</p>
            </div>
          )}

          {/* Peso */}
          <div className="space-y-2">
            <Label htmlFor="peso">Nova Pesagem (kg) *</Label>
            <NumericInput
              id="peso"
              step="0.01"
              min="1"
              placeholder="Ex: 380"
              value={peso}
              onChange={(e) => setPeso(e.target.value)}
              autoFocus
              required
            />
            {calcularGMD() && (
              <p className="text-sm text-muted-foreground">
                GMD estimado: <strong>{calcularGMD()} kg/dia</strong>
              </p>
            )}
          </div>

          {/* Warning */}
          {showWarning && (
            <div className="flex items-start gap-2 rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm text-warning">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{showWarning}</span>
            </div>
          )}

          {/* Data */}
          <div className="space-y-2">
            <Label htmlFor="data">Data *</Label>
            <Input
              id="data"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              required
            />
          </div>

          {/* Responsável */}
          <div className="space-y-2">
            <Label htmlFor="responsavel">Responsável</Label>
            <Select value={responsavelId} onValueChange={setResponsavelId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {responsaveis?.map((resp) => (
                  <SelectItem key={resp.id} value={resp.id}>
                    {resp.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="obs">Observações</Label>
            <Textarea
              id="obs"
              placeholder="Opcional..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </div>

          {/* Botões */}
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
              disabled={createPesagemMutation.isPending}
            >
              {createPesagemMutation.isPending ? (
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
      </DialogContent>
    </Dialog>
  );
}
