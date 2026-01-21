import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Wheat, Loader2, Package, Edit, Trash2 } from 'lucide-react';

const tiposDieta = [
  'Confinado',
  'Pasto',
  'Semi-confinado',
  'Volumoso',
  'Concentrado',
  'Misto',
];

interface Dieta {
  id: string;
  nome: string;
  consumo_diario_kg: number;
  custo_por_kg: number | null;
  tipo: string | null;
  composicao: string | null;
  ativo: boolean;
}

export default function Dietas() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dietaEditando, setDietaEditando] = useState<Dieta | null>(null);
  const [dietaDeletar, setDietaDeletar] = useState<string | null>(null);

  // Form state
  const [nome, setNome] = useState('');
  const [consumoDiario, setConsumoDiario] = useState('');
  const [custoPorKg, setCustoPorKg] = useState('');
  const [tipo, setTipo] = useState('');
  const [composicao, setComposicao] = useState('');

  const { data: dietas, isLoading } = useQuery({
    queryKey: ['dietas', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dietas')
        .select('*')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data as Dieta[];
    },
    enabled: !!user,
  });

  // Fetch lotes usando cada dieta
  const { data: lotesUsandoDietas } = useQuery({
    queryKey: ['lotes-por-dieta', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lotes')
        .select('id, dieta_id')
        .eq('ativo', true);
      if (error) throw error;

      const count: Record<string, number> = {};
      data?.forEach(l => {
        if (l.dieta_id) {
          count[l.dieta_id] = (count[l.dieta_id] || 0) + 1;
        }
      });
      return count;
    },
    enabled: !!user,
  });

  // Create/Update mutation
  const saveDietaMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Usuário não autenticado');

      const dados = {
        nome: nome.trim(),
        consumo_diario_kg: parseFloat(consumoDiario),
        custo_por_kg: custoPorKg ? parseFloat(custoPorKg) : null,
        tipo: tipo || null,
        composicao: composicao.trim() || null,
      };

      if (dietaEditando) {
        // Update
        const { error } = await supabase
          .from('dietas')
          .update(dados)
          .eq('id', dietaEditando.id);
        if (error) throw error;
      } else {
        // Create
        const { error } = await supabase
          .from('dietas')
          .insert({
            ...dados,
            user_id: user.id,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dietas'] });
      toast.success(dietaEditando ? 'Dieta atualizada!' : 'Dieta criada!');
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast.error('Erro ao salvar dieta', {
        description: error.message,
      });
    },
  });

  // Delete mutation
  const deleteDietaMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('dietas')
        .update({ ativo: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dietas'] });
      toast.success('Dieta removida!');
      setDeleteDialogOpen(false);
      setDietaDeletar(null);
    },
    onError: (error: any) => {
      toast.error('Erro ao remover dieta', {
        description: error.message,
      });
    },
  });

  const handleOpenDialog = (dieta?: Dieta) => {
    if (dieta) {
      setDietaEditando(dieta);
      setNome(dieta.nome);
      setConsumoDiario(dieta.consumo_diario_kg?.toString() || '');
      setCustoPorKg(dieta.custo_por_kg?.toString() || '');
      setTipo(dieta.tipo || '');
      setComposicao(dieta.composicao || '');
    } else {
      setDietaEditando(null);
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setDietaEditando(null);
    resetForm();
  };

  const resetForm = () => {
    setNome('');
    setConsumoDiario('');
    setCustoPorKg('');
    setTipo('');
    setComposicao('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error('Informe o nome');
      return;
    }
    if (!consumoDiario || parseFloat(consumoDiario) <= 0) {
      toast.error('Informe o consumo diário');
      return;
    }
    saveDietaMutation.mutate();
  };

  const handleDelete = (id: string) => {
    setDietaDeletar(id);
    setDeleteDialogOpen(true);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value || 0);
  };

  const calcularCustoDiario = (dieta: Dieta) => {
    if (!dieta.custo_por_kg) return 0;
    return Number(dieta.consumo_diario_kg) * Number(dieta.custo_por_kg);
  };

  const calcularCustoMensal = (dieta: Dieta) => {
    return calcularCustoDiario(dieta) * 30;
  };

  return (
    <AppLayout>
      <div className="container py-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dietas</h1>
            <p className="text-muted-foreground">Gestão de alimentação</p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="hidden sm:flex">
                <Plus className="mr-2 h-4 w-4" />
                Nova Dieta
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {dietaEditando ? 'Editar Dieta' : 'Criar Dieta'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome *</Label>
                  <Input
                    id="nome"
                    placeholder="Ex: Alto Grão"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="consumo">Consumo/dia (kg/animal) *</Label>
                  <Input
                    id="consumo"
                    type="number"
                    step="0.01"
                    min="0.1"
                    placeholder="Ex: 8.5"
                    value={consumoDiario}
                    onChange={(e) => setConsumoDiario(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Quanto cada animal consome por dia
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="custo">Custo/kg (R$)</Label>
                  <Input
                    id="custo"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Ex: 1.50"
                    value={custoPorKg}
                    onChange={(e) => setCustoPorKg(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo</Label>
                  <Select value={tipo} onValueChange={setTipo}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {tiposDieta.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="composicao">Composição</Label>
                  <Textarea
                    id="composicao"
                    placeholder="Ex: Milho 60%, Soja 20%, Núcleo 20%"
                    value={composicao}
                    onChange={(e) => setComposicao(e.target.value)}
                    rows={2}
                  />
                </div>

                {/* Preview do Custo */}
                {consumoDiario && custoPorKg && (
                  <div className="rounded-lg bg-primary/5 p-3 space-y-1">
                    <p className="text-sm font-medium">💰 Custos Estimados:</p>
                    <div className="text-sm space-y-0.5">
                      <p>
                        Por dia/animal:{' '}
                        <span className="font-semibold">
                          {formatCurrency(parseFloat(consumoDiario) * parseFloat(custoPorKg))}
                        </span>
                      </p>
                      <p>
                        Por mês/animal:{' '}
                        <span className="font-semibold">
                          {formatCurrency(parseFloat(consumoDiario) * parseFloat(custoPorKg) * 30)}
                        </span>
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={handleCloseDialog}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={saveDietaMutation.isPending}
                  >
                    {saveDietaMutation.isPending ? (
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
        </div>

        {/* Lista de Dietas */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="mb-2 h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : dietas && dietas.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {dietas.map((dieta) => {
              const custoDiario = calcularCustoDiario(dieta);
              const custoMensal = calcularCustoMensal(dieta);
              const lotesUsando = lotesUsandoDietas?.[dieta.id] || 0;

              return (
                <Card key={dieta.id} className="transition-shadow hover:shadow-md">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2 text-lg mb-1">
                          <Wheat className="h-5 w-5 text-primary" />
                          {dieta.nome}
                        </CardTitle>
                        {dieta.tipo && (
                          <Badge variant="secondary" className="text-xs">
                            {dieta.tipo}
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleOpenDialog(dieta)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDelete(dieta.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Consumo: </span>
                      <span className="font-medium">{Number(dieta.consumo_diario_kg)} kg/dia</span>
                    </div>

                    {dieta.custo_por_kg && (
                      <>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Custo/kg: </span>
                          <span className="font-medium">{formatCurrency(Number(dieta.custo_por_kg))}</span>
                        </div>

                        <div className="rounded-lg bg-muted p-2 space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Custo/dia/animal</span>
                            <span className="font-semibold text-primary">{formatCurrency(custoDiario)}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Custo/mês/animal</span>
                            <span className="font-semibold">{formatCurrency(custoMensal)}</span>
                          </div>
                        </div>
                      </>
                    )}

                    {dieta.composicao && (
                      <div className="text-xs text-muted-foreground">
                        <p className="font-medium mb-1">Composição:</p>
                        <p className="line-clamp-2">{dieta.composicao}</p>
                      </div>
                    )}

                    <div className="flex items-center gap-1 pt-1 text-xs text-muted-foreground border-t">
                      <Package className="h-3 w-3 mt-1" />
                      <span>{lotesUsando} {lotesUsando === 1 ? 'lote usando' : 'lotes usando'}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Wheat className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">Nenhuma dieta cadastrada</h3>
              <p className="mb-4 text-center text-sm text-muted-foreground">
                Crie dietas para gerenciar a alimentação dos lotes
              </p>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Criar Dieta
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Mobile FAB */}
        <div className="fixed bottom-20 right-4 md:hidden">
          <Button
            size="lg"
            className="h-14 w-14 rounded-full shadow-lg"
            onClick={() => handleOpenDialog()}
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>

        {/* Dialog Deletar */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover dieta?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta dieta será removida. Lotes que a utilizam ficarão sem dieta
                associada.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => dietaDeletar && deleteDietaMutation.mutate(dietaDeletar)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteDietaMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Removendo...
                  </>
                ) : (
                  'Remover'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
