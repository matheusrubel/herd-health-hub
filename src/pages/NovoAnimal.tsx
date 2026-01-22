import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { ArrowLeft, ChevronDown, Loader2 } from 'lucide-react';

export default function NovoAnimal() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [moreDetails, setMoreDetails] = useState(false);

  // Form state
  const [numeroBrinco, setNumeroBrinco] = useState('');
  const [loteId, setLoteId] = useState('');
  const [pesoEntrada, setPesoEntrada] = useState('');
  const [dataEntrada, setDataEntrada] = useState(new Date().toISOString().split('T')[0]);
  const [valorAquisicao, setValorAquisicao] = useState('');
  const [responsavelId, setResponsavelId] = useState('');
  const [racaId, setRacaId] = useState(''); // ← MUDOU: agora é ID
  const [sexo, setSexo] = useState('');
  const [idadeMeses, setIdadeMeses] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const { data: lotes } = useQuery({
    queryKey: ['lotes', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lotes')
        .select('id, nome')
        .order('nome');
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

  // ═══════════════════════════════════════════
  // NOVO: BUSCAR RAÇAS DO BANCO
  // ═══════════════════════════════════════════
  const { data: racas } = useQuery({
    queryKey: ['racas', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('racas')
        .select('id, nome')
        .order('nome');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const createAnimalMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Usuário não autenticado');

      const peso = parseFloat(pesoEntrada);
      const valor = valorAquisicao ? parseFloat(valorAquisicao) : 0;
      const idade = idadeMeses ? parseInt(idadeMeses) : null;

      // ═══════════════════════════════════════════
      // 1. CRIAR ANIMAL
      // ═══════════════════════════════════════════
      const { data: animal, error: animalError } = await supabase
        .from('animais')
        .insert({
          user_id: user.id,
          numero_brinco: numeroBrinco,
          lote_id: loteId || null,
          peso_entrada: peso,
          data_entrada: dataEntrada,
          valor_aquisicao: valor,
          responsavel_id: responsavelId || null,
          raca_id: racaId || null, // ← MUDOU: salva raca_id (UUID)
          sexo: sexo || null,
          idade_meses: idade,
          observacoes: observacoes || null,
        })
        .select()
        .single();

      if (animalError) throw animalError;

      // ═══════════════════════════════════════════
      // 2. CRIAR PRIMEIRA PESAGEM
      // ═══════════════════════════════════════════
      const { error: pesagemError } = await supabase
        .from('pesagens')
        .insert({
          user_id: user.id,
          animal_id: animal.id,
          data: dataEntrada,
          peso: peso,
          responsavel_id: responsavelId || null,
          observacoes: 'Peso de entrada',
        });

      if (pesagemError) throw pesagemError;

      return animal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['animais'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['financeiro-aquisicoes'] });
      toast.success('Animal cadastrado com sucesso!');
      navigate('/animais');
    },
    onError: (error: any) => {
      if (error.message?.includes('unique')) {
        toast.error('Número de brinco já existe');
      } else if (error.message?.includes('check')) {
        toast.error('Erro ao cadastrar animal', {
          description: 'Verifique os dados e tente novamente',
        });
      } else {
        toast.error('Erro ao cadastrar animal', {
          description: error.message,
        });
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!numeroBrinco.trim()) {
      toast.error('Informe o número do brinco');
      return;
    }

    if (!pesoEntrada || parseFloat(pesoEntrada) <= 0) {
      toast.error('Informe um peso válido');
      return;
    }

    createAnimalMutation.mutate();
  };

  return (
    <AppLayout>
      <div className="container max-w-2xl py-6">
        <div className="mb-6 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Cadastrar Animal</h1>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Número Brinco */}
              <div className="space-y-2">
                <Label htmlFor="numero_brinco">Nº Brinco *</Label>
                <Input
                  id="numero_brinco"
                  placeholder="Ex: 305"
                  value={numeroBrinco}
                  onChange={(e) => setNumeroBrinco(e.target.value)}
                  required
                />
              </div>

              {/* Lote */}
              <div className="space-y-2">
                <Label htmlFor="lote">Lote</Label>
                <Select value={loteId} onValueChange={setLoteId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o lote" />
                  </SelectTrigger>
                  <SelectContent>
                    {lotes?.map((lote) => (
                      <SelectItem key={lote.id} value={lote.id}>
                        {lote.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Peso de Entrada */}
              <div className="space-y-2">
                <Label htmlFor="peso_entrada">Peso de Entrada (kg) *</Label>
                <NumericInput
                  id="peso_entrada"
                  step="0.01"
                  min="0"
                  placeholder="Ex: 285"
                  value={pesoEntrada}
                  onChange={(e) => setPesoEntrada(e.target.value)}
                  required
                />
              </div>

              {/* Data de Entrada */}
              <div className="space-y-2">
                <Label htmlFor="data_entrada">Data de Entrada *</Label>
                <Input
                  id="data_entrada"
                  type="date"
                  value={dataEntrada}
                  onChange={(e) => setDataEntrada(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>

              {/* Valor Aquisição */}
              <div className="space-y-2">
                <Label htmlFor="valor_aquisicao">Valor Aquisição (R$)</Label>
                <NumericInput
                  id="valor_aquisicao"
                  step="0.01"
                  min="0"
                  placeholder="Ex: 3500.00"
                  value={valorAquisicao}
                  onChange={(e) => setValorAquisicao(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Este valor será usado nos dashboards e relatórios
                </p>
              </div>

              {/* Responsável */}
              <div className="space-y-2">
                <Label htmlFor="responsavel">Responsável</Label>
                <Select value={responsavelId} onValueChange={setResponsavelId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o responsável" />
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

              {/* More Details Collapsible */}
              <Collapsible open={moreDetails} onOpenChange={setMoreDetails}>
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="ghost" className="w-full justify-between">
                    Mais Detalhes
                    <ChevronDown className={`h-4 w-4 transition-transform ${moreDetails ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-4">
                  {/* Raça - CORRIGIDO */}
                  <div className="space-y-2">
                    <Label htmlFor="raca">Raça</Label>
                    <Select value={racaId} onValueChange={setRacaId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a raça" />
                      </SelectTrigger>
                      <SelectContent>
                        {racas?.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {(!racas || racas.length === 0) && (
                      <p className="text-xs text-muted-foreground">
                        Nenhuma raça cadastrada. <button type="button" onClick={() => navigate('/configuracoes')} className="text-primary underline">Cadastrar raças</button>
                      </p>
                    )}
                  </div>

                  {/* Sexo */}
                  <div className="space-y-2">
                    <Label>Sexo</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="sexo"
                          value="Macho"
                          checked={sexo === 'Macho'}
                          onChange={(e) => setSexo(e.target.value)}
                          className="h-4 w-4 text-primary"
                        />
                        Macho
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="sexo"
                          value="Fêmea"
                          checked={sexo === 'Fêmea'}
                          onChange={(e) => setSexo(e.target.value)}
                          className="h-4 w-4 text-primary"
                        />
                        Fêmea
                      </label>
                    </div>
                  </div>

                  {/* Idade */}
                  <div className="space-y-2">
                    <Label htmlFor="idade_meses">Idade (meses)</Label>
                    <NumericInput
                      id="idade_meses"
                      min="0"
                      placeholder="Ex: 18"
                      value={idadeMeses}
                      onChange={(e) => setIdadeMeses(e.target.value)}
                    />
                  </div>

                  {/* Observações */}
                  <div className="space-y-2">
                    <Label htmlFor="observacoes">Observações</Label>
                    <Textarea
                      id="observacoes"
                      placeholder="Informações adicionais..."
                      value={observacoes}
                      onChange={(e) => setObservacoes(e.target.value)}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate(-1)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={createAnimalMutation.isPending}
                >
                  {createAnimalMutation.isPending ? (
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
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}