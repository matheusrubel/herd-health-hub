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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Syringe, Calendar, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { format, addDays, isBefore, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const tiposProtocolo = [
  'Vacina',
  'Vermífugo',
  'Antibiótico',
  'Vitamina',
  'Carrapaticida',
  'Outro',
];

export default function Sanitario() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [data, setData] = useState(new Date().toISOString().split('T')[0]);
  const [tipo, setTipo] = useState('');
  const [produto, setProduto] = useState('');
  const [dose, setDose] = useState('');
  const [custo, setCusto] = useState('');
  const [aplicacao, setAplicacao] = useState('todos');
  const [loteId, setLoteId] = useState('');
  const [animalId, setAnimalId] = useState('');
  const [responsavelId, setResponsavelId] = useState('');
  const [proximaDose, setProximaDose] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const { data: lotes } = useQuery({
    queryKey: ['lotes', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lotes')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: animais } = useQuery({
    queryKey: ['animais-simples', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('animais')
        .select('id, numero_brinco')
        .eq('ativo', true)
        .order('numero_brinco');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

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
    enabled: !!user,
  });

  const { data: protocolos, isLoading } = useQuery({
    queryKey: ['protocolos', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('protocolos_sanitarios')
        .select(`
          *,
          lotes(nome),
          animais(numero_brinco),
          responsaveis(nome)
        `)
        .order('data', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Próximas doses
  const proximasDoses = protocolos?.filter(p => {
    if (!p.proxima_dose) return false;
    const proximaData = new Date(p.proxima_dose);
    return isAfter(proximaData, new Date()) || format(proximaData, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
  }).sort((a, b) => new Date(a.proxima_dose!).getTime() - new Date(b.proxima_dose!).getTime()) || [];

  const createProtocoloMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('protocolos_sanitarios')
        .insert({
          user_id: user.id,
          data,
          tipo,
          produto,
          dose: dose || null,
          custo: custo ? parseFloat(custo) : null,
          aplicacao,
          lote_id: aplicacao === 'lote' ? loteId : null,
          animal_id: aplicacao === 'animal' ? animalId : null,
          responsavel_id: responsavelId || null,
          proxima_dose: proximaDose || null,
          observacoes: observacoes || null,
        });

      if (error) throw error;

      // Se tiver custo, criar gasto sanitário
      if (custo && parseFloat(custo) > 0) {
        await supabase
          .from('gastos')
          .insert({
            user_id: user.id,
            data,
            tipo: 'Sanitário',
            valor: parseFloat(custo),
            descricao: `${tipo}: ${produto}`,
            aplicacao,
            lote_id: aplicacao === 'lote' ? loteId : null,
            animal_id: aplicacao === 'animal' ? animalId : null,
          });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['protocolos'] });
      queryClient.invalidateQueries({ queryKey: ['gastos'] });
      toast.success('Protocolo registrado!');
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error('Erro ao registrar protocolo', {
        description: error.message,
      });
    },
  });

  const resetForm = () => {
    setData(new Date().toISOString().split('T')[0]);
    setTipo('');
    setProduto('');
    setDose('');
    setCusto('');
    setAplicacao('todos');
    setLoteId('');
    setAnimalId('');
    setResponsavelId('');
    setProximaDose('');
    setObservacoes('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tipo) {
      toast.error('Selecione o tipo');
      return;
    }
    if (!produto.trim()) {
      toast.error('Informe o produto');
      return;
    }
    if (aplicacao === 'lote' && !loteId) {
      toast.error('Selecione o lote');
      return;
    }
    if (aplicacao === 'animal' && !animalId) {
      toast.error('Selecione o animal');
      return;
    }
    createProtocoloMutation.mutate();
  };

  const diasAte = (dataStr: string) => {
    const diff = Math.ceil((new Date(dataStr).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <AppLayout>
      <div className="container py-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Sanitário</h1>
            <p className="text-muted-foreground">Protocolos e tratamentos</p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="hidden sm:flex">
                <Plus className="mr-2 h-4 w-4" />
                Novo Protocolo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Registrar Protocolo</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="data">Data da Aplicação *</Label>
                  <Input
                    id="data"
                    type="date"
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo *</Label>
                  <Select value={tipo} onValueChange={setTipo}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {tiposProtocolo.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="produto">Produto *</Label>
                  <Input
                    id="produto"
                    placeholder="Ex: Vacina Aftosa"
                    value={produto}
                    onChange={(e) => setProduto(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dose">Dose</Label>
                  <Input
                    id="dose"
                    placeholder="Ex: 2ml/animal"
                    value={dose}
                    onChange={(e) => setDose(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="custo">Custo Total (R$)</Label>
                  <Input
                    id="custo"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Ex: 500.00"
                    value={custo}
                    onChange={(e) => setCusto(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="responsavel">Responsável</Label>
                  <Select value={responsavelId} onValueChange={setResponsavelId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {responsaveis?.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Aplicar em:</Label>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="aplicacao"
                        value="todos"
                        checked={aplicacao === 'todos'}
                        onChange={(e) => setAplicacao(e.target.value)}
                        className="h-4 w-4"
                      />
                      Todos
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="aplicacao"
                        value="lote"
                        checked={aplicacao === 'lote'}
                        onChange={(e) => setAplicacao(e.target.value)}
                        className="h-4 w-4"
                      />
                      Lote
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="aplicacao"
                        value="animal"
                        checked={aplicacao === 'animal'}
                        onChange={(e) => setAplicacao(e.target.value)}
                        className="h-4 w-4"
                      />
                      Animal
                    </label>
                  </div>
                </div>

                {aplicacao === 'lote' && (
                  <div className="space-y-2">
                    <Label>Lote *</Label>
                    <Select value={loteId} onValueChange={setLoteId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {lotes?.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {aplicacao === 'animal' && (
                  <div className="space-y-2">
                    <Label>Animal *</Label>
                    <Select value={animalId} onValueChange={setAnimalId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {animais?.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            #{a.numero_brinco}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="proxima">Próxima Dose</Label>
                  <Input
                    id="proxima"
                    type="date"
                    value={proximaDose}
                    onChange={(e) => setProximaDose(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="obs">Observações</Label>
                  <Textarea
                    id="obs"
                    placeholder="Opcional..."
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={createProtocoloMutation.isPending}
                  >
                    {createProtocoloMutation.isPending ? (
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

        {/* Tabs */}
        <Tabs defaultValue="proximas" className="space-y-4">
          <TabsList>
            <TabsTrigger value="proximas" className="gap-2">
              <Calendar className="h-4 w-4" />
              Próximas Doses
              {proximasDoses.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {proximasDoses.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          {/* Próximas Doses */}
          <TabsContent value="proximas">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Próximas Doses
                </CardTitle>
              </CardHeader>
              <CardContent>
                {proximasDoses.length > 0 ? (
                  <div className="space-y-3">
                    {proximasDoses.map((p) => {
                      const dias = diasAte(p.proxima_dose!);
                      const isUrgente = dias <= 3;

                      return (
                        <div
                          key={p.id}
                          className={`flex items-start justify-between rounded-lg border p-4 ${
                            isUrgente ? 'border-warning bg-warning/5' : ''
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {isUrgente ? (
                              <AlertTriangle className="mt-0.5 h-5 w-5 text-warning" />
                            ) : (
                              <Syringe className="mt-0.5 h-5 w-5 text-muted-foreground" />
                            )}
                            <div>
                              <p className="font-medium">{p.produto}</p>
                              <p className="text-sm text-muted-foreground">
                                {p.tipo} • {p.aplicacao === 'todos' ? 'Todos animais' : p.aplicacao === 'lote' ? (p.lotes as any)?.nome : `#${(p.animais as any)?.numero_brinco}`}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant={isUrgente ? 'destructive' : 'outline'}>
                              {dias === 0 ? 'Hoje' : dias === 1 ? 'Amanhã' : `Em ${dias} dias`}
                            </Badge>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {format(new Date(p.proxima_dose!), 'dd/MM/yyyy')}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <CheckCircle className="mb-4 h-12 w-12 text-success" />
                    <p className="text-muted-foreground">Nenhuma dose programada</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Histórico */}
          <TabsContent value="historico">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Protocolos</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : protocolos && protocolos.length > 0 ? (
                  <div className="space-y-2">
                    {protocolos.map((p) => (
                      <div key={p.id} className="flex items-center justify-between rounded-lg border p-3">
                        <div className="flex items-center gap-3">
                          <Syringe className="h-5 w-5 text-primary" />
                          <div>
                            <p className="font-medium">{p.produto}</p>
                            <p className="text-sm text-muted-foreground">
                              {p.tipo} • {p.aplicacao === 'todos' ? 'Todos' : p.aplicacao === 'lote' ? (p.lotes as any)?.nome : `#${(p.animais as any)?.numero_brinco}`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            {format(new Date(p.data), 'dd/MM/yyyy')}
                          </p>
                          {p.custo && (
                            <p className="text-xs text-muted-foreground">
                              R$ {Number(p.custo).toFixed(2)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-8 text-center text-muted-foreground">
                    Nenhum protocolo registrado
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Mobile FAB */}
        <div className="fixed bottom-20 right-4 md:hidden">
          <Button
            size="lg"
            className="h-14 w-14 rounded-full shadow-lg"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
